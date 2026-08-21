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
    {
      input: sql,
      encoding: 'utf8'
    }
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
    {
      input: sql,
      encoding: 'utf8'
    }
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
    `m2-i05-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@test.local`;

  const { data, error } =
    await publicClient.auth.signUp({
      email,
      password: 'M2I05-Test-Password-123!'
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

  const org1Id =
    randomUUID() as UUID;
  const org2Id =
    randomUUID() as UUID;
  const location1Id =
    randomUUID() as UUID;
  const ingredient1Id =
    randomUUID() as UUID;

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
    values (
      '${ingredient1Id}',
      '${org1Id}',
      'M2-I05 Ingredient',
      null,
      'ea',
      'active'
    )
    on conflict do nothing;

    insert into private.role_permissions (
      role_class,
      permission_id
    )
    values
      ('manager', 'm2.claim.manage'),
      ('manager', 'm2.claim.read'),
      ('staff', 'm2.claim.read')
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

async function createClaimDefinition(
  ctx: TestContext,
  code: string,
  displayName: string
): Promise<string> {
  const { data, error } =
    await ctx.serverClient.rpc(
      'm2_create_ingredient_claim_definition',
      {
        p_auth_principal_id:
          ctx.user1AuthId,
        p_application_user_id:
          ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id:
          ctx.org1Id,
        p_code:
          code,
        p_display_name:
          displayName,
        p_description:
          null,
        p_correlation_id:
          randomUUID()
      }
    );

  if (error || !data) {
    throw new Error(
      `Failed to create Claim Definition: ${error?.message}`
    );
  }

  return data as string;
}

interface RecordClaimInput {
  ingredientId?: string;
  claimDefinitionId: string;
  valueState:
    | 'known'
    | 'unknown'
    | 'not_applicable';
  booleanValue: boolean | null;
  effectiveFrom: string;
  organizationId?: string;
  correlationId?: string;
}

async function recordClaim(
  ctx: TestContext,
  input: RecordClaimInput
) {
  return ctx.serverClient.rpc(
    'm2_record_ingredient_claim_assertion',
    {
      p_auth_principal_id:
        ctx.user1AuthId,
      p_application_user_id:
        ctx.user1AppId,
      p_aal: 'aal1',
      p_organization_id:
        input.organizationId
        ?? ctx.org1Id,
      p_ingredient_id:
        input.ingredientId
        ?? ctx.ingredient1Id,
      p_claim_definition_id:
        input.claimDefinitionId,
      p_value_state:
        input.valueState,
      p_boolean_value:
        input.booleanValue,
      p_effective_from:
        input.effectiveFrom,
      p_correlation_id:
        input.correlationId
        ?? randomUUID()
    }
  );
}

testFn(
  'M2-I05 Ingredient Claims integration',
  () => {
    let ctx: TestContext;
    let claimDefinitionId: string;

    beforeAll(async () => {
      ctx = await setupContext();

      claimDefinitionId =
        await createClaimDefinition(
          ctx,
          'contains_shellfish',
          'Contains Shellfish'
        );
    });

    test('creates governed Claim Definition', () => {
      expect(
        localQuery(`
          select code || '|' || lifecycle_status
          from public.ingredient_claim_definitions
          where id = '${claimDefinitionId}';
        `)
      ).toBe(
        'contains_shellfish|active'
      );
    });

    test('records known false without collapsing false into unknown', async () => {
      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId,
            valueState: 'known',
            booleanValue: false,
            effectiveFrom:
              '2026-08-20T12:00:00Z'
          }
        );

      expect(error).toBeNull();

      expect(
        localQuery(`
          select
            value_state
            || '|'
            || boolean_value::text
          from public.ingredient_claim_assertions
          where claim_definition_id =
            '${claimDefinitionId}'
            and effective_from =
              '2026-08-20T12:00:00Z';
        `)
      ).toBe('known|false');
    });

    test('records unknown with no boolean value', async () => {
      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId,
            valueState: 'unknown',
            booleanValue: null,
            effectiveFrom:
              '2026-08-21T12:00:00Z'
          }
        );

      expect(error).toBeNull();

      expect(
        localQuery(`
          select
            value_state
            || '|'
            || (boolean_value is null)::text
          from public.ingredient_claim_assertions
          where claim_definition_id =
            '${claimDefinitionId}'
            and effective_from =
              '2026-08-21T12:00:00Z';
        `)
      ).toBe('unknown|true');
    });

    test('records not_applicable with no boolean value', async () => {
      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId,
            valueState: 'not_applicable',
            booleanValue: null,
            effectiveFrom:
              '2026-08-22T12:00:00Z'
          }
        );

      expect(error).toBeNull();
    });


    test('rejects inconsistent claim value-state pairs', async () => {
      const knownMissingValue =
        await recordClaim(
          ctx,
          {
            claimDefinitionId,
            valueState: 'known',
            booleanValue: null,
            effectiveFrom:
              '2026-08-23T12:00:00Z'
          }
        );

      expect(
        knownMissingValue.error
      ).not.toBeNull();

      const unknownWithValue =
        await recordClaim(
          ctx,
          {
            claimDefinitionId,
            valueState: 'unknown',
            booleanValue: false,
            effectiveFrom:
              '2026-08-24T12:00:00Z'
          }
        );

      expect(
        unknownWithValue.error
      ).not.toBeNull();
    });

    test('allows historical backfill and resolves assertions by effective time', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'historical_test_claim',
          'Historical Test Claim'
        );

      expect(
        (
          await recordClaim(
            ctx,
            {
              claimDefinitionId:
                definitionId,
              valueState: 'known',
              booleanValue: true,
              effectiveFrom:
                '2026-08-20T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();

      expect(
        (
          await recordClaim(
            ctx,
            {
              claimDefinitionId:
                definitionId,
              valueState: 'known',
              booleanValue: false,
              effectiveFrom:
                '2026-08-10T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();

      expect(
        localQuery(`
          select boolean_value::text
          from public.ingredient_claim_assertions
          where ingredient_id =
            '${ctx.ingredient1Id}'
            and claim_definition_id =
              '${definitionId}'
            and effective_from <=
              '2026-08-15T12:00:00Z'
          order by effective_from desc
          limit 1;
        `)
      ).toBe('false');
    });

    test('rejects duplicate assertion at exact effective instant', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'duplicate_instant_claim',
          'Duplicate Instant Claim'
        );

      const effectiveFrom =
        '2026-08-25T12:00:00Z';

      expect(
        (
          await recordClaim(
            ctx,
            {
              claimDefinitionId:
                definitionId,
              valueState: 'known',
              booleanValue: true,
              effectiveFrom
            }
          )
        ).error
      ).toBeNull();

      expect(
        (
          await recordClaim(
            ctx,
            {
              claimDefinitionId:
                definitionId,
              valueState: 'known',
              booleanValue: false,
              effectiveFrom
            }
          )
        ).error
      ).not.toBeNull();
    });

    test('organization claim read permission exposes claim data', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const definitions =
        await client
          .from('ingredient_claim_definitions')
          .select('id')
          .eq('organization_id', ctx.org1Id);

      expect(definitions.error).toBeNull();
      expect(
        (definitions.data ?? []).length
      ).toBeGreaterThan(0);

      const assertions =
        await client
          .from('ingredient_claim_assertions')
          .select('id')
          .eq('organization_id', ctx.org1Id);

      expect(assertions.error).toBeNull();
      expect(
        (assertions.data ?? []).length
      ).toBeGreaterThan(0);
    });

    test('location-scoped claim read does not inherit organization read', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user2Token
        );

      const definitions =
        await client
          .from('ingredient_claim_definitions')
          .select('id')
          .eq('organization_id', ctx.org1Id);

      expect(definitions.error).toBeNull();
      expect(definitions.data).toEqual([]);

      const assertions =
        await client
          .from('ingredient_claim_assertions')
          .select('id')
          .eq('organization_id', ctx.org1Id);

      expect(assertions.error).toBeNull();
      expect(assertions.data).toEqual([]);
    });

    test('authenticated client cannot directly mutate claims or execute service command', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const directDefinitionInsert =
        await client
          .from('ingredient_claim_definitions')
          .insert({
            organization_id: ctx.org1Id,
            code: 'direct_insert_forbidden',
            display_name: 'Direct Insert Forbidden',
            lifecycle_status: 'active'
          });

      expect(
        directDefinitionInsert.error
      ).not.toBeNull();

      const directAssertionInsert =
        await client
          .from('ingredient_claim_assertions')
          .insert({
            organization_id: ctx.org1Id,
            ingredient_id: ctx.ingredient1Id,
            claim_definition_id: claimDefinitionId,
            value_state: 'known',
            boolean_value: true,
            effective_from:
              '2026-08-30T12:00:00Z'
          });

      expect(
        directAssertionInsert.error
      ).not.toBeNull();

      const rpcResult =
        await client.rpc(
          'm2_record_ingredient_claim_assertion',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_ingredient_id:
              ctx.ingredient1Id,
            p_claim_definition_id:
              claimDefinitionId,
            p_value_state: 'known',
            p_boolean_value: true,
            p_effective_from:
              '2026-08-31T12:00:00Z',
            p_correlation_id:
              randomUUID()
          }
        );

      expect(rpcResult.error).not.toBeNull();
    });

    test('organization A manager cannot manage claims in organization B', async () => {
      const { error } =
        await recordClaim(
          ctx,
          {
            organizationId:
              ctx.org2Id,
            claimDefinitionId,
            valueState: 'known',
            booleanValue: true,
            effectiveFrom:
              '2026-09-01T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects new claim assertion for archived Ingredient', async () => {
      const archivedIngredientId =
        randomUUID();

      localSql(`
        insert into public.ingredients (
          id,
          organization_id,
          display_name,
          base_canonical_unit,
          lifecycle_status,
          archived_at
        )
        values (
          '${archivedIngredientId}',
          '${ctx.org1Id}',
          'M2-I05 Archived Ingredient',
          'ea',
          'archived',
          now()
        );
      `);

      const { error } =
        await recordClaim(
          ctx,
          {
            ingredientId:
              archivedIngredientId,
            claimDefinitionId,
            valueState: 'known',
            booleanValue: true,
            effectiveFrom:
              '2026-09-02T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects new assertion for inactive Claim Definition', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'inactive_definition_claim',
          'Inactive Definition Claim'
        );

      const updateResult =
        await ctx.serverClient.rpc(
          'm2_update_ingredient_claim_definition',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_claim_definition_id:
              definitionId,
            p_display_name:
              'Inactive Definition Claim',
            p_description:
              null,
            p_lifecycle_status:
              'inactive',
            p_correlation_id:
              randomUUID()
          }
        );

      expect(updateResult.error).toBeNull();

      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId:
              definitionId,
            valueState: 'known',
            booleanValue: true,
            effectiveFrom:
              '2026-09-02T18:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('Claim Definition archive requires aal2', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'aal2_archive_claim',
          'AAL2 Archive Claim'
        );

      const aal1Result =
        await ctx.serverClient.rpc(
          'm2_archive_ingredient_claim_definition',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_claim_definition_id:
              definitionId,
            p_correlation_id:
              randomUUID()
          }
        );

      expect(
        aal1Result.error
      ).not.toBeNull();

      const aal2Result =
        await ctx.serverClient.rpc(
          'm2_archive_ingredient_claim_definition',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal2',
            p_organization_id:
              ctx.org1Id,
            p_claim_definition_id:
              definitionId,
            p_correlation_id:
              randomUUID()
          }
        );

      expect(
        aal2Result.error
      ).toBeNull();
    });

    test('rejects new assertion for archived Claim Definition', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'archived_definition_claim',
          'Archived Definition Claim'
        );

      const archiveResult =
        await ctx.serverClient.rpc(
          'm2_archive_ingredient_claim_definition',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal2',
            p_organization_id:
              ctx.org1Id,
            p_claim_definition_id:
              definitionId,
            p_correlation_id:
              randomUUID()
          }
        );

      expect(
        archiveResult.error
      ).toBeNull();

      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId:
              definitionId,
            valueState: 'known',
            booleanValue: true,
            effectiveFrom:
              '2026-09-03T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('Claim Definition code is case-insensitively unique within organization', async () => {
      await createClaimDefinition(
        ctx,
        'Unique_Test_Claim',
        'Unique Test Claim'
      );

      const duplicate =
        await ctx.serverClient.rpc(
          'm2_create_ingredient_claim_definition',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_code:
              'unique_test_claim',
            p_display_name:
              'Duplicate Claim',
            p_description:
              null,
            p_correlation_id:
              randomUUID()
          }
        );

      expect(duplicate.error).not.toBeNull();
    });

    test('successful assertion produces protected_operational F39 audit evidence', async () => {
      const definitionId =
        await createClaimDefinition(
          ctx,
          'audit_claim',
          'Audit Claim'
        );

      const correlationId =
        randomUUID();

      const { error } =
        await recordClaim(
          ctx,
          {
            claimDefinitionId:
              definitionId,
            valueState: 'known',
            booleanValue: true,
            effectiveFrom:
              '2026-09-04T12:00:00Z',
            correlationId
          }
        );

      expect(error).toBeNull();

      expect(
        localQuery(`
          select
            action
            || '|'
            || retention_profile
          from private.audit_records
          where correlation_id =
            '${correlationId}';
        `)
      ).toBe(
        'm2.claim_assertion.record|protected_operational'
      );
    });
  }
);
