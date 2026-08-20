import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
      'exec',
      '-i',
      'supabase_db_kitcheniq-2',
      'psql',
      '-U',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
      '-q'
    ],
    { input: sql, encoding: 'utf8' }
  );
}

function localQuery(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      'supabase_db_kitcheniq-2',
      'psql',
      '-U',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1'
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
  publicConfig: ReturnType<typeof loadSupabasePublicConfig>;
  serverConfig: ReturnType<typeof loadSupabaseServerConfig>;
  publicClient: SupabaseClient;
  serverClient: SupabaseClient;
  org1Id: UUID;
  org2Id: UUID;
  location1Id: UUID;
  ingredient1Id: UUID;
  ingredient2Id: UUID;
  user1AuthId: string;
  user1AppId: UUID;
  user1Token: string;
  user2AuthId: string;
  user2AppId: UUID;
  user2Token: string;
}

async function createTestUser(
  publicClient: SupabaseClient,
  label: string
) {
  const email =
    `m2-i02-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@test.local`;

  const { data, error } = await publicClient.auth.signUp({
    email,
    password: 'M2I02-Test-Password-123!'
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
  const publicConfig = loadSupabasePublicConfig({
    KITCHENIQ_SUPABASE_URL:
      process.env.KITCHENIQ_SUPABASE_URL
      ?? 'http://127.0.0.1:54321',
    KITCHENIQ_SUPABASE_PUBLIC_KEY:
      process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY
      ?? 'missing'
  });

  const serverConfig = loadSupabaseServerConfig({
    KITCHENIQ_SUPABASE_URL: publicConfig.url,
    KITCHENIQ_SUPABASE_PUBLIC_KEY: publicConfig.publicKey,
    KITCHENIQ_SUPABASE_SECRET_KEY:
      process.env.KITCHENIQ_SUPABASE_SECRET_KEY
      ?? 'missing'
  });

  const publicClient =
    createClient(publicConfig.url, publicConfig.publicKey);

  const serverClient =
    createClient(serverConfig.url, serverConfig.secretKey);

  const org1Id =
    '550e8400-e29b-41d4-a716-446655440101' as UUID;
  const org2Id =
    '550e8400-e29b-41d4-a716-446655440102' as UUID;
  const location1Id =
    '550e8400-e29b-41d4-a716-446655440103' as UUID;
  const ingredient1Id =
    '550e8400-e29b-41d4-a716-446655440111' as UUID;
  const ingredient2Id =
    '550e8400-e29b-41d4-a716-446655440112' as UUID;

  localSql(`
    insert into public.organizations (id)
    values
      ('${org1Id}'),
      ('${org2Id}')
    on conflict do nothing;

    insert into public.locations (
      id,
      organization_id
    )
    values (
      '${location1Id}',
      '${org1Id}'
    )
    on conflict do nothing;

    insert into public.ingredients (
      id,
      organization_id,
      display_name,
      description,
      base_canonical_unit,
      lifecycle_status
    )
    values
      (
        '${ingredient1Id}',
        '${org1Id}',
        'M2-I02 Shrimp',
        null,
        'g',
        'active'
      ),
      (
        '${ingredient2Id}',
        '${org2Id}',
        'M2-I02 Oil',
        null,
        'mL',
        'active'
      )
    on conflict do nothing;

    insert into private.role_permissions (
      role_class,
      permission_id
    )
    values
      ('manager', 'm2.purchase_spec.read'),
      ('manager', 'm2.purchase_spec.manage'),
      ('staff', 'm2.purchase_spec.read')
    on conflict do nothing;
  `);

  const user1 = await createTestUser(
    publicClient,
    'manager'
  );

  const user2 = await createTestUser(
    publicClient,
    'location'
  );

  const identity1 =
    await resolveAuthenticatedApplicationUser(
      user1.token,
      publicConfig
    );

  const identity2 =
    await resolveAuthenticatedApplicationUser(
      user2.token,
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
    serverConfig,
    publicClient,
    serverClient,
    org1Id,
    org2Id,
    location1Id,
    ingredient1Id,
    ingredient2Id,
    user1AuthId: user1.authId,
    user1AppId: identity1.userId,
    user1Token: user1.token,
    user2AuthId: user2.authId,
    user2AppId: identity2.userId,
    user2Token: user2.token
  };
}

async function createSpec(
  ctx: TestContext,
  label: string,
  correlationId: string,
  effectiveFrom = '2026-08-19T12:00:00Z'
): Promise<string> {
  const { data, error } = await ctx.serverClient.rpc(
    'm2_create_purchase_specification',
    {
      p_auth_principal_id: ctx.user1AuthId,
      p_application_user_id: ctx.user1AppId,
      p_aal: 'aal1',
      p_organization_id: ctx.org1Id,
      p_ingredient_id: ctx.ingredient1Id,
      p_specification_label: label,
      p_effective_from: effectiveFrom,
      p_package_labels: ['case', 'bag'],
      p_units_per_parent: [null, '6'],
      p_terminal_quantity: '2267.96185000',
      p_terminal_unit: 'g',
      p_correlation_id: correlationId
    }
  );

  if (error || !data) {
    throw new Error(
      `Failed to create Purchase Specification: ${error?.message}`
    );
  }

  return data as string;
}

testFn('M2-I02 Purchase Specification integration', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupContext();
  }, 30000);

  test('authorized manager creates specification, version 1 and package hierarchy', async () => {
    const specId = await createSpec(
      ctx,
      '6 x 5 lb Bags',
      '550e8400-e29b-41d4-a716-446655440201'
    );

    const { data: specification, error } =
      await ctx.serverClient
        .from('ingredient_purchase_specifications')
        .select('*')
        .eq('id', specId)
        .single();

    expect(error).toBeNull();
    expect(specification?.ingredient_id)
      .toBe(ctx.ingredient1Id);
    expect(specification?.organization_id)
      .toBe(ctx.org1Id);
    expect(specification?.lifecycle_status)
      .toBe('active');

    const { data: versions } =
      await ctx.serverClient
        .from('ingredient_purchase_specification_versions')
        .select('*')
        .eq('purchase_specification_id', specId);

    expect(versions).toHaveLength(1);
    expect(versions?.[0]?.version_number).toBe(1);
    expect(versions?.[0]?.specification_label)
      .toBe('6 x 5 lb Bags');

    const versionId = versions?.[0]?.id;

    const { data: levels } =
      await ctx.serverClient
        .from(
          'ingredient_purchase_specification_package_levels'
        )
        .select('*')
        .eq(
          'purchase_specification_version_id',
          versionId
        )
        .order('ordinal');

    expect(levels).toHaveLength(2);

    expect(levels?.[0]?.package_label).toBe('case');
    expect(levels?.[0]?.units_per_parent).toBeNull();
    expect(levels?.[0]?.terminal_quantity).toBeNull();

    expect(levels?.[1]?.package_label).toBe('bag');
    expect(Number(levels?.[1]?.units_per_parent)).toBe(6);
    expect(levels?.[1]?.terminal_unit).toBe('g');
  });

  test('creates immutable later version with supersedes relationship', async () => {
    const specId = await createSpec(
      ctx,
      'Version One',
      '550e8400-e29b-41d4-a716-446655440202'
    );

    const { data: firstVersion } =
      await ctx.serverClient
        .from('ingredient_purchase_specification_versions')
        .select('*')
        .eq('purchase_specification_id', specId)
        .single();

    const { data: newVersionId, error } =
      await ctx.serverClient.rpc(
        'm2_add_purchase_specification_version',
        {
          p_auth_principal_id: ctx.user1AuthId,
          p_application_user_id: ctx.user1AppId,
          p_aal: 'aal1',
          p_organization_id: ctx.org1Id,
          p_purchase_specification_id: specId,
          p_specification_label: 'Version Two',
          p_effective_from: '2026-08-20T12:00:00Z',
          p_package_labels: ['case'],
          p_units_per_parent: [null],
          p_terminal_quantity: '11339.80740000',
          p_terminal_unit: 'g',
          p_correlation_id:
            '550e8400-e29b-41d4-a716-446655440203'
        }
      );

    expect(error).toBeNull();

    const { data: secondVersion } =
      await ctx.serverClient
        .from('ingredient_purchase_specification_versions')
        .select('*')
        .eq('id', newVersionId)
        .single();

    expect(secondVersion?.version_number).toBe(2);
    expect(secondVersion?.supersedes_version_id)
      .toBe(firstVersion?.id);

    const { data: originalAgain } =
      await ctx.serverClient
        .from('ingredient_purchase_specification_versions')
        .select('*')
        .eq('id', firstVersion?.id)
        .single();

    expect(originalAgain?.version_number).toBe(1);
    expect(originalAgain?.specification_label)
      .toBe('Version One');
  });

  test('rejects version whose effective time does not move forward', async () => {
    const specId = await createSpec(
      ctx,
      'Effective Date Test',
      '550e8400-e29b-41d4-a716-446655440204',
      '2026-08-20T12:00:00Z'
    );

    const { error } = await ctx.serverClient.rpc(
      'm2_add_purchase_specification_version',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_purchase_specification_id: specId,
        p_specification_label: 'Bad Time',
        p_effective_from: '2026-08-19T12:00:00Z',
        p_package_labels: ['case'],
        p_units_per_parent: [null],
        p_terminal_quantity: '100',
        p_terminal_unit: 'g',
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440205'
      }
    );

    expect(error).toBeTruthy();
    expect(error?.message).toContain(
      'effective_from must be later'
    );
  });

  test('rejects terminal canonical unit that differs from Ingredient base unit', async () => {
    const { error } = await ctx.serverClient.rpc(
      'm2_create_purchase_specification',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ctx.ingredient1Id,
        p_specification_label: 'Wrong Unit',
        p_effective_from: '2026-08-19T12:00:00Z',
        p_package_labels: ['case'],
        p_units_per_parent: [null],
        p_terminal_quantity: '10',
        p_terminal_unit: 'mL',
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440206'
      }
    );

    expect(error).toBeTruthy();
    expect(error?.message).toContain(
      'must match Ingredient base canonical unit'
    );
  });

  test('supports active to inactive lifecycle transition', async () => {
    const specId = await createSpec(
      ctx,
      'Status Test',
      '550e8400-e29b-41d4-a716-446655440207'
    );

    const { error } = await ctx.serverClient.rpc(
      'm2_set_purchase_specification_status',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_purchase_specification_id: specId,
        p_lifecycle_status: 'inactive',
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440208'
      }
    );

    expect(error).toBeNull();

    const { data } =
      await ctx.serverClient
        .from('ingredient_purchase_specifications')
        .select('lifecycle_status')
        .eq('id', specId)
        .single();

    expect(data?.lifecycle_status).toBe('inactive');
  });

  test('archive fails at AAL1 and succeeds at AAL2 without deleting history', async () => {
    const specId = await createSpec(
      ctx,
      'Archive Test',
      '550e8400-e29b-41d4-a716-446655440209'
    );

    const aal1 = await ctx.serverClient.rpc(
      'm2_archive_purchase_specification',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_purchase_specification_id: specId,
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440210'
      }
    );

    expect(aal1.error).toBeTruthy();
    expect(aal1.error?.message).toContain(
      'requires aal2'
    );

    const aal2 = await ctx.serverClient.rpc(
      'm2_archive_purchase_specification',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal2',
        p_organization_id: ctx.org1Id,
        p_purchase_specification_id: specId,
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440211'
      }
    );

    expect(aal2.error).toBeNull();

    const { data } =
      await ctx.serverClient
        .from('ingredient_purchase_specifications')
        .select('*')
        .eq('id', specId)
        .single();

    expect(data?.lifecycle_status).toBe('archived');
    expect(data?.archived_at).toBeTruthy();

    const { data: versions } =
      await ctx.serverClient
        .from('ingredient_purchase_specification_versions')
        .select('id')
        .eq('purchase_specification_id', specId);

    expect(versions).toHaveLength(1);
  });

  test('authenticated user without permission receives no specification rows', async () => {
    const specId = await createSpec(
      ctx,
      'Default Deny',
      '550e8400-e29b-41d4-a716-446655440212'
    );

    expect(specId).toBeTruthy();

    const user = await createTestUser(
      ctx.publicClient,
      'no-permission'
    );

    await resolveAuthenticatedApplicationUser(
      user.token,
      ctx.publicConfig
    );

    const client = authenticatedClient(
      ctx.publicConfig.url,
      ctx.publicConfig.publicKey,
      user.token
    );

    const { data, error } = await client
      .from('ingredient_purchase_specifications')
      .select('*')
      .eq('organization_id', ctx.org1Id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('location-scoped read does not inherit organization Purchase Specification read', async () => {
    await createSpec(
      ctx,
      'Location Scope',
      '550e8400-e29b-41d4-a716-446655440213'
    );

    const client = authenticatedClient(
      ctx.publicConfig.url,
      ctx.publicConfig.publicKey,
      ctx.user2Token
    );

    const { data, error } = await client
      .from('ingredient_purchase_specifications')
      .select('*')
      .eq('organization_id', ctx.org1Id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  test('organization-scoped read permission exposes organization rows', async () => {
    const specId = await createSpec(
      ctx,
      'Authorized Read',
      '550e8400-e29b-41d4-a716-446655440214'
    );

    const client = authenticatedClient(
      ctx.publicConfig.url,
      ctx.publicConfig.publicKey,
      ctx.user1Token
    );

    const { data, error } = await client
      .from('ingredient_purchase_specifications')
      .select('id')
      .eq('id', specId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  test('authenticated client cannot directly insert/update/delete Purchase Specification state', async () => {
    const specId = await createSpec(
      ctx,
      'Direct DML',
      '550e8400-e29b-41d4-a716-446655440215'
    );

    const client = authenticatedClient(
      ctx.publicConfig.url,
      ctx.publicConfig.publicKey,
      ctx.user1Token
    );

    const insertAttempt = await client
      .from('ingredient_purchase_specifications')
      .insert({
        organization_id: ctx.org1Id,
        ingredient_id: ctx.ingredient1Id,
        lifecycle_status: 'active'
      });

    expect(insertAttempt.error).toBeTruthy();

    const updateAttempt = await client
      .from('ingredient_purchase_specifications')
      .update({
        lifecycle_status: 'inactive'
      })
      .eq('id', specId);

    expect(updateAttempt.error).toBeTruthy();

    const deleteAttempt = await client
      .from('ingredient_purchase_specifications')
      .delete()
      .eq('id', specId);

    expect(deleteAttempt.error).toBeTruthy();
  });

  test('organization A manager cannot manage organization B Purchase Specification', async () => {
    const { error } = await ctx.serverClient.rpc(
      'm2_create_purchase_specification',
      {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org2Id,
        p_ingredient_id: ctx.ingredient2Id,
        p_specification_label: 'Cross Org',
        p_effective_from: '2026-08-19T12:00:00Z',
        p_package_labels: ['case'],
        p_units_per_parent: [null],
        p_terminal_quantity: '3785.411784',
        p_terminal_unit: 'mL',
        p_correlation_id:
          '550e8400-e29b-41d4-a716-446655440216'
      }
    );

    expect(error).toBeTruthy();
    expect(error?.message).toContain(
      'not authorized'
    );
  });

  test('successful commands produce protected operational audit evidence', async () => {
    const correlationId =
      '550e8400-e29b-41d4-a716-446655440217';

    const specId = await createSpec(
      ctx,
      'Audit Test',
      correlationId
    );

    const audit = JSON.parse(
      localQuery(`
        select row_to_json(audit_record)
        from private.audit_records as audit_record
        where correlation_id = '${correlationId}'
          and target_id = '${specId}';
      `)
    );

    expect(audit.action)
      .toBe('m2.purchase_spec.create');
    expect(audit.target_kind)
      .toBe('ingredient_purchase_specification');
    expect(audit.organization_id)
      .toBe(ctx.org1Id);
    expect(audit.scope_kind)
      .toBe('organization');
    expect(audit.retention_profile)
      .toBe('protected_operational');
  });

  test('version and package rows reject historical update/delete even through postgres', async () => {
    const specId = await createSpec(
      ctx,
      'Immutable History',
      '550e8400-e29b-41d4-a716-446655440218'
    );

    const versionId = localQuery(`
      select id
      from public.ingredient_purchase_specification_versions
      where purchase_specification_id = '${specId}'
      order by version_number
      limit 1;
    `);

    expect(() =>
      localSql(`
        update public.ingredient_purchase_specification_versions
        set specification_label = 'Mutated'
        where id = '${versionId}';
      `)
    ).toThrow();

    expect(() =>
      localSql(`
        delete from public.ingredient_purchase_specification_package_levels
        where purchase_specification_version_id = '${versionId}';
      `)
    ).toThrow();
  });
});
