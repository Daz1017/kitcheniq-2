import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  createClient,
  type SupabaseClient
} from '@supabase/supabase-js';
import {
  loadSupabasePublicConfig,
  loadSupabaseServerConfig,
  resolveAuthenticatedApplicationUser
} from '../../../src/foundation/runtime';
import type { UUID } from '../../../src/foundation/identifiers';

const skip =
  !process.env.KITCHENIQ_SUPABASE_URL
  || !process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY
  || !process.env.KITCHENIQ_SUPABASE_SECRET_KEY;

const testFn = skip ? describe.skip : describe;

function localSql(sql: string): void {
  execFileSync(
    'docker',
    [
      'exec', '-i',
      'supabase_db_kitcheniq-2',
      'psql', '-U', 'postgres',
      '-v', 'ON_ERROR_STOP=1',
      '-q'
    ],
    { input: sql, encoding: 'utf8' }
  );
}

function localQuery(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec', '-i',
      'supabase_db_kitcheniq-2',
      'psql', '-U', 'postgres',
      '-At',
      '-v', 'ON_ERROR_STOP=1'
    ],
    { input: sql, encoding: 'utf8' }
  ).trim();
}

function authenticatedClient(
  url: string,
  publicKey: string,
  token: string
): SupabaseClient {
  return createClient(url, publicKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}

interface TestContext {
  publicConfig:
    ReturnType<typeof loadSupabasePublicConfig>;
  serverClient: SupabaseClient;
  publicClient: SupabaseClient;
  org1Id: UUID;
  org2Id: UUID;
  location1Id: UUID;
  ingredient1Id: UUID;
  user1AuthId: string;
  user1AppId: UUID;
  user1Token: string;
  user2Token: string;
}

async function createTestUser(
  publicClient: SupabaseClient,
  label: string
) {
  const email =
    `m2-i06-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@test.local`;

  const { data, error } =
    await publicClient.auth.signUp({
      email,
      password: 'M2I06-Test-Password-123!'
    });

  if (
    error
    || !data.user?.id
    || !data.session?.access_token
  ) {
    throw new Error(
      `Failed to create test user ${label}: ${error?.message}`
    );
  }

  return {
    authId: data.user.id,
    token: data.session.access_token
  };
}

async function setupContext(): Promise<TestContext> {
  const publicConfig =
    loadSupabasePublicConfig({
      KITCHENIQ_SUPABASE_URL:
        process.env.KITCHENIQ_SUPABASE_URL
        ?? 'http://127.0.0.1:54321',
      KITCHENIQ_SUPABASE_PUBLIC_KEY:
        process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY
        ?? 'missing'
    });

  const serverConfig =
    loadSupabaseServerConfig({
      KITCHENIQ_SUPABASE_URL:
        publicConfig.url,
      KITCHENIQ_SUPABASE_PUBLIC_KEY:
        publicConfig.publicKey,
      KITCHENIQ_SUPABASE_SECRET_KEY:
        process.env.KITCHENIQ_SUPABASE_SECRET_KEY
        ?? 'missing'
    });

  const publicClient =
    createClient(
      publicConfig.url,
      publicConfig.publicKey
    );

  const serverClient =
    createClient(
      serverConfig.url,
      serverConfig.secretKey
    );

  const org1Id = randomUUID() as UUID;
  const org2Id = randomUUID() as UUID;
  const location1Id = randomUUID() as UUID;
  const ingredient1Id = randomUUID() as UUID;

  localSql(`
    insert into public.organizations (id)
    values
      ('${org1Id}'),
      ('${org2Id}');

    insert into public.locations (
      id,
      organization_id
    )
    values (
      '${location1Id}',
      '${org1Id}'
    );

    insert into public.ingredients (
      id,
      organization_id,
      display_name,
      base_canonical_unit,
      lifecycle_status
    )
    values (
      '${ingredient1Id}',
      '${org1Id}',
      'M2-I06 Ingredient',
      'ea',
      'active'
    );

    insert into private.role_permissions (
      role_class,
      permission_id
    )
    values
      ('manager', 'm2.handling.manage'),
      ('manager', 'm2.handling.read'),
      ('staff', 'm2.handling.read')
    on conflict do nothing;
  `);

  const manager =
    await createTestUser(
      publicClient,
      'manager'
    );

  const locationReader =
    await createTestUser(
      publicClient,
      'location-reader'
    );

  const identity1 =
    await resolveAuthenticatedApplicationUser(
      manager.token,
      publicConfig
    );

  const identity2 =
    await resolveAuthenticatedApplicationUser(
      locationReader.token,
      publicConfig
    );

  localSql(`
    insert into private.role_assignments (
      application_user_id,
      role_class,
      scope_kind,
      organization_id,
      location_id
    )
    values
      (
        '${identity1.userId}',
        'manager',
        'organization',
        '${org1Id}',
        null
      ),
      (
        '${identity2.userId}',
        'staff',
        'location',
        '${org1Id}',
        '${location1Id}'
      );
  `);

  return {
    publicConfig,
    serverClient,
    publicClient,
    org1Id,
    org2Id,
    location1Id,
    ingredient1Id,
    user1AuthId: manager.authId,
    user1AppId: identity1.userId,
    user1Token: manager.token,
    user2Token: locationReader.token
  };
}

async function createHandlingDefinition(
  ctx: TestContext,
  code: string,
  displayName: string
): Promise<string> {
  const { data, error } =
    await ctx.serverClient.rpc(
      'm2_create_ingredient_handling_definition',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_code: code,
        p_display_name: displayName,
        p_description: null,
        p_correlation_id: randomUUID()
      }
    );

  if (error || !data) {
    throw new Error(
      `Failed to create Handling Definition: ${error?.message}`
    );
  }

  return data as string;
}

async function recordHandling(
  ctx: TestContext,
  input: {
    handlingDefinitionId: string;
    valueState:
      | 'known'
      | 'unknown'
      | 'not_applicable';
    instructionText: string | null;
    effectiveFrom: string;
    ingredientId?: string;
    organizationId?: string;
    correlationId?: string;
  }
) {
  return ctx.serverClient.rpc(
    'm2_record_ingredient_handling_instruction',
    {
      p_auth_principal_id: ctx.user1AuthId,
      p_application_user_id: ctx.user1AppId,
      p_aal: 'aal1',
      p_organization_id:
        input.organizationId ?? ctx.org1Id,
      p_ingredient_id:
        input.ingredientId ?? ctx.ingredient1Id,
      p_handling_definition_id:
        input.handlingDefinitionId,
      p_value_state: input.valueState,
      p_instruction_text: input.instructionText,
      p_effective_from: input.effectiveFrom,
      p_correlation_id:
        input.correlationId ?? randomUUID()
    }
  );
}

testFn('M2-I06 Ingredient Handling integration', () => {
  let ctx: TestContext;
  let definitionId: string;

  beforeAll(async () => {
    ctx = await setupContext();

    definitionId =
      await createHandlingDefinition(
        ctx,
        `storage_${randomUUID()}`,
        'Storage Instruction'
      );
  });

  test('records known handling instruction with normalized text', async () => {
    const effectiveFrom =
      '2026-08-20T12:00:00.000Z';

    const { data, error } =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText:
          '  Keep sealed after opening  ',
        effectiveFrom
      });

    expect(error).toBeNull();
    expect(data).toEqual(expect.any(String));

    const { data: stored, error: readError } =
      await ctx.serverClient
        .from('ingredient_handling_instructions')
        .select(
          'value_state,instruction_text,effective_from'
        )
        .eq('id', data)
        .single();

    expect(readError).toBeNull();
    expect(stored).toMatchObject({
      value_state: 'known',
      instruction_text:
        'Keep sealed after opening'
    });

    expect(
      new Date(stored!.effective_from).toISOString()
    ).toBe(effectiveFrom);
  });

  test('records unknown handling with null instruction', async () => {
    const { data, error } =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'unknown',
        instructionText: null,
        effectiveFrom:
          '2026-08-21T12:00:00.000Z'
      });

    expect(error).toBeNull();

    const { data: stored, error: readError } =
      await ctx.serverClient
        .from('ingredient_handling_instructions')
        .select('value_state,instruction_text')
        .eq('id', data)
        .single();

    expect(readError).toBeNull();
    expect(stored).toEqual({
      value_state: 'unknown',
      instruction_text: null
    });
  });

  test('records not_applicable handling with null instruction', async () => {
    const { data, error } =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'not_applicable',
        instructionText: null,
        effectiveFrom:
          '2026-08-22T12:00:00.000Z'
      });

    expect(error).toBeNull();

    const { data: stored, error: readError } =
      await ctx.serverClient
        .from('ingredient_handling_instructions')
        .select('value_state,instruction_text')
        .eq('id', data)
        .single();

    expect(readError).toBeNull();
    expect(stored).toEqual({
      value_state: 'not_applicable',
      instruction_text: null
    });
  });

  test('allows historical backfill', async () => {
    const { error } =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: 'Historical instruction',
        effectiveFrom:
          '2025-01-15T12:00:00.000Z'
      });

    expect(error).toBeNull();
  });

  test('rejects duplicate exact effective instant', async () => {
    const effectiveFrom =
      '2026-08-23T12:00:00.000Z';

    const first =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: 'First version',
        effectiveFrom
      });

    expect(first.error).toBeNull();

    const second =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: 'Duplicate instant',
        effectiveFrom
      });

    expect(second.error).not.toBeNull();
  });

  test('rejects known state without instruction text', async () => {
    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: null,
        effectiveFrom:
          '2026-08-24T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();
  });

  test('rejects unknown state with instruction text', async () => {
    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'unknown',
        instructionText: 'Should not exist',
        effectiveFrom:
          '2026-08-25T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();
  });

  test('rejects not_applicable state with instruction text', async () => {
    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'not_applicable',
        instructionText: 'Should not exist',
        effectiveFrom:
          '2026-08-26T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();
  });

  test('location-scoped read does not inherit organization read', async () => {
    const client =
      authenticatedClient(
        ctx.publicConfig.url,
        ctx.publicConfig.publicKey,
        ctx.user2Token
      );

    const { data, error } =
      await client
        .from('ingredient_handling_definitions')
        .select('id')
        .eq('id', definitionId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('authenticated client cannot directly mutate protected handling tables', async () => {
    const client =
      authenticatedClient(
        ctx.publicConfig.url,
        ctx.publicConfig.publicKey,
        ctx.user1Token
      );

    const { error } =
      await client
        .from('ingredient_handling_definitions')
        .insert({
          organization_id: ctx.org1Id,
          code: `direct_${randomUUID()}`,
          display_name: 'Direct Insert',
          lifecycle_status: 'active'
        });

    expect(error).not.toBeNull();
  });

  test('authenticated client cannot execute handling mutation RPC', async () => {
    const client =
      authenticatedClient(
        ctx.publicConfig.url,
        ctx.publicConfig.publicKey,
        ctx.user1Token
      );

    const { error } =
      await client.rpc(
        'm2_create_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org1Id,
          p_code: `rpc_${randomUUID()}`,
          p_display_name: 'Forbidden RPC',
          p_description: null,
          p_correlation_id: randomUUID()
        }
      );

    expect(error).not.toBeNull();
  });

  test('manager cannot manage Handling Definitions in another organization', async () => {
    const { error } =
      await ctx.serverClient.rpc(
        'm2_create_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org2Id,
          p_code: `cross_org_${randomUUID()}`,
          p_display_name: 'Cross Org',
          p_description: null,
          p_correlation_id: randomUUID()
        }
      );

    expect(error).not.toBeNull();
  });

  test('rejects new handling instruction for archived Ingredient', async () => {
    localSql(`
      update public.ingredients
      set
        lifecycle_status = 'archived',
        archived_at = now(),
        updated_at = now()
      where id = '${ctx.ingredient1Id}';
    `);

    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: 'Should fail',
        effectiveFrom:
          '2026-08-27T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();

    localSql(`
      update public.ingredients
      set
        lifecycle_status = 'active',
        archived_at = null,
        updated_at = now()
      where id = '${ctx.ingredient1Id}';
    `);
  });

  test('rejects new instruction for inactive Handling Definition', async () => {
    const inactiveId =
      await createHandlingDefinition(
        ctx,
        `inactive_${randomUUID()}`,
        'Inactive Handling'
      );

    const { error: updateError } =
      await ctx.serverClient.rpc(
        'm2_update_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org1Id,
          p_handling_definition_id: inactiveId,
          p_display_name: 'Inactive Handling',
          p_description: null,
          p_lifecycle_status: 'inactive',
          p_correlation_id: randomUUID()
        }
      );

    expect(updateError).toBeNull();

    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: inactiveId,
        valueState: 'known',
        instructionText: 'Should fail',
        effectiveFrom:
          '2026-08-28T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();
  });

  test('Handling Definition archive requires AAL2', async () => {
    const archiveId =
      await createHandlingDefinition(
        ctx,
        `archive_aal_${randomUUID()}`,
        'Archive AAL Test'
      );

    const { error } =
      await ctx.serverClient.rpc(
        'm2_archive_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org1Id,
          p_handling_definition_id: archiveId,
          p_correlation_id: randomUUID()
        }
      );

    expect(error).not.toBeNull();
  });

  test('rejects new instruction for archived Handling Definition', async () => {
    const archiveId =
      await createHandlingDefinition(
        ctx,
        `archived_${randomUUID()}`,
        'Archived Handling'
      );

    const { error: archiveError } =
      await ctx.serverClient.rpc(
        'm2_archive_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal2',
          p_organization_id: ctx.org1Id,
          p_handling_definition_id: archiveId,
          p_correlation_id: randomUUID()
        }
      );

    expect(archiveError).toBeNull();

    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: archiveId,
        valueState: 'known',
        instructionText: 'Should fail',
        effectiveFrom:
          '2026-08-29T12:00:00.000Z'
      });

    expect(result.error).not.toBeNull();
  });

  test('Handling Definition code is case-insensitively unique within organization', async () => {
    const suffix = randomUUID();

    await createHandlingDefinition(
      ctx,
      `Case_${suffix}`,
      'Case One'
    );

    const { error } =
      await ctx.serverClient.rpc(
        'm2_create_ingredient_handling_definition',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org1Id,
          p_code: `case_${suffix}`,
          p_display_name: 'Case Two',
          p_description: null,
          p_correlation_id: randomUUID()
        }
      );

    expect(error).not.toBeNull();
  });

  test('successful handling instruction audit uses protected_operational retention', async () => {
    const correlationId = randomUUID();

    const result =
      await recordHandling(ctx, {
        handlingDefinitionId: definitionId,
        valueState: 'known',
        instructionText: 'Audit retention test',
        effectiveFrom:
          '2026-08-30T12:00:00.000Z',
        correlationId
      });

    expect(result.error).toBeNull();

    expect(
      localQuery(`
        select retention_profile
        from private.audit_records
        where correlation_id = '${correlationId}';
      `)
    ).toBe('protected_operational');
  });
});
