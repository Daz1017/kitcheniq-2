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
    `m2-i04-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@test.local`;

  const { data, error } =
    await publicClient.auth.signUp({
      email,
      password: 'M2I04-Test-Password-123!'
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
    '550e8400-e29b-41d4-a716-446655444101' as UUID;
  const org2Id =
    '550e8400-e29b-41d4-a716-446655444102' as UUID;
  const location1Id =
    '550e8400-e29b-41d4-a716-446655444103' as UUID;
  const ingredient1Id =
    '550e8400-e29b-41d4-a716-446655444104' as UUID;

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
      'M2-I04 Ingredient',
      null,
      'g',
      'active'
    )
    on conflict do nothing;

    insert into private.role_permissions (
      role_class,
      permission_id
    )
    values
      ('manager', 'm2.purchase_spec.manage'),
      ('manager', 'm2.purchase_spec.read'),
      ('manager', 'm2.vendor_mapping.manage'),
      ('manager', 'm2.vendor_mapping.read'),
      ('manager', 'm2.cost.manage'),
      ('manager', 'm2.cost.read'),
      ('staff', 'm2.cost.read')
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

async function createPurchaseSpec(
  ctx: TestContext,
  label: string,
  effectiveFrom = '2026-08-01T12:00:00Z'
): Promise<string> {
  const { data, error } =
    await ctx.serverClient.rpc(
      'm2_create_purchase_specification',
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
        p_specification_label:
          label,
        p_effective_from:
          effectiveFrom,
        p_package_labels:
          ['case'],
        p_units_per_parent:
          [null],
        p_terminal_quantity:
          '100',
        p_terminal_unit:
          'g',
        p_correlation_id:
          randomUUID()
      }
    );

  if (error || !data) {
    throw new Error(
      `Failed to create Purchase Specification: ${error?.message}`
    );
  }

  return data as string;
}

async function createSupplierProduct(
  ctx: TestContext,
  purchaseSpecificationId: string,
  effectiveFrom: string,
  externalId = randomUUID()
): Promise<string> {
  const { data, error } =
    await ctx.serverClient.rpc(
      'm2_create_supplier_product_mapping',
      {
        p_auth_principal_id:
          ctx.user1AuthId,
        p_application_user_id:
          ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id:
          ctx.org1Id,
        p_source_namespace:
          'm2-i04-test',
        p_external_id:
          externalId,
        p_purchase_specification_id:
          purchaseSpecificationId,
        p_effective_from:
          effectiveFrom,
        p_correlation_id:
          randomUUID()
      }
    );

  if (error || !data) {
    throw new Error(
      `Failed to create Supplier Product: ${error?.message}`
    );
  }

  return data as string;
}

async function addSupplierProductMappingVersion(
  ctx: TestContext,
  supplierProductId: string,
  purchaseSpecificationId: string,
  effectiveFrom: string
): Promise<void> {
  const { error } =
    await ctx.serverClient.rpc(
      'm2_add_supplier_product_mapping_version',
      {
        p_auth_principal_id:
          ctx.user1AuthId,
        p_application_user_id:
          ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id:
          ctx.org1Id,
        p_supplier_product_id:
          supplierProductId,
        p_purchase_specification_id:
          purchaseSpecificationId,
        p_effective_from:
          effectiveFrom,
        p_correlation_id:
          randomUUID()
      }
    );

  if (error) {
    throw new Error(
      `Failed to add Supplier Product mapping version: ${error.message}`
    );
  }
}

interface RecordCostInput {
  purchaseSpecificationId: string;
  valueState?: 'known' | 'unknown' | 'not_applicable';
  unitCost?: string | null;
  currency?: string | null;
  sourceKind?: 'manual' | 'supplier_product';
  supplierProductId?: string | null;
  effectiveFrom: string;
  correlationId?: string;
  organizationId?: string;
}

async function recordCost(
  ctx: TestContext,
  input: RecordCostInput
) {
  return ctx.serverClient.rpc(
    'm2_record_purchase_specification_cost',
    {
      p_auth_principal_id:
        ctx.user1AuthId,
      p_application_user_id:
        ctx.user1AppId,
      p_aal: 'aal1',
      p_organization_id:
        input.organizationId
        ?? ctx.org1Id,
      p_purchase_specification_id:
        input.purchaseSpecificationId,
      p_value_state:
        input.valueState
        ?? 'known',
      p_unit_cost:
        input.unitCost !== undefined
          ? input.unitCost
          : (
              input.valueState === 'unknown'
                ? null
                : '1'
            ),
      p_currency:
        input.currency !== undefined
          ? input.currency
          : (
              input.valueState === 'unknown'
                ? null
                : 'USD'
            ),
      p_source_kind:
        input.sourceKind
        ?? 'manual',
      p_supplier_product_id:
        input.supplierProductId
        ?? null,
      p_effective_from:
        input.effectiveFrom,
      p_correlation_id:
        input.correlationId
        ?? randomUUID()
    }
  );
}

testFn(
  'M2-I04 Purchase Specification Cost State integration',
  () => {
    let ctx: TestContext;
    let baseSpecId: string;

    beforeAll(async () => {
      ctx = await setupContext();

      baseSpecId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Base Spec'
        );
    });

    test('persists unit cost at NUMERIC(20,8) boundary and preserves currency exactly', async () => {
      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              baseSpecId,
            unitCost:
              '1.234567895',
            currency:
              'usd',
            effectiveFrom:
              '2026-08-05T12:00:00Z'
          }
        );

      expect(error).toBeNull();

      expect(
        localQuery(`
          select
            unit_cost::text || '|' || currency
          from public.ingredient_purchase_specification_cost_observations
          where purchase_specification_id =
            '${baseSpecId}'
            and effective_from =
              '2026-08-05T12:00:00Z';
        `)
      ).toBe(
        '1.23456790|usd'
      );
    });

    test('records explicit unknown cost with no amount or currency', async () => {
      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              baseSpecId,
            valueState: 'unknown',
            effectiveFrom:
              '2026-08-06T12:00:00Z'
          }
        );

      expect(error).toBeNull();

      expect(
        localQuery(`
          select
            value_state
            || '|'
            || (unit_cost is null)::text
            || '|'
            || (currency is null)::text
          from public.ingredient_purchase_specification_cost_observations
          where purchase_specification_id =
            '${baseSpecId}'
            and effective_from =
              '2026-08-06T12:00:00Z';
        `)
      ).toBe(
        'unknown|true|true'
      );
    });

    test('rejects not_applicable Purchase Specification cost state', async () => {
      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              baseSpecId,
            valueState:
              'not_applicable',
            unitCost: null,
            currency: null,
            effectiveFrom:
              '2026-08-07T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects inconsistent known and unknown value pairs', async () => {
      const knownMissingCurrency =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              baseSpecId,
            valueState: 'known',
            unitCost: '4.25',
            currency: null,
            effectiveFrom:
              '2026-08-08T12:00:00Z'
          }
        );

      expect(
        knownMissingCurrency.error
      ).not.toBeNull();

      const unknownWithValue =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              baseSpecId,
            valueState: 'unknown',
            unitCost: '4.25',
            currency: 'USD',
            effectiveFrom:
              '2026-08-09T12:00:00Z'
          }
        );

      expect(
        unknownWithValue.error
      ).not.toBeNull();
    });

    test('allows historical backfill and resolves history by effective time', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Backfill Spec'
        );

      expect(
        (
          await recordCost(
            ctx,
            {
              purchaseSpecificationId:
                specId,
              unitCost: '20',
              effectiveFrom:
                '2026-08-20T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();

      expect(
        (
          await recordCost(
            ctx,
            {
              purchaseSpecificationId:
                specId,
              unitCost: '10',
              effectiveFrom:
                '2026-08-10T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();

      expect(
        localQuery(`
          select string_agg(
            unit_cost::text,
            ','
            order by effective_from
          )
          from public.ingredient_purchase_specification_cost_observations
          where purchase_specification_id =
            '${specId}';
        `)
      ).toBe(
        '10.00000000,20.00000000'
      );

      expect(
        localQuery(`
          select unit_cost::text
          from public.ingredient_purchase_specification_cost_observations
          where purchase_specification_id =
            '${specId}'
            and effective_from <=
              '2026-08-15T12:00:00Z'
          order by effective_from desc
          limit 1;
        `)
      ).toBe(
        '10.00000000'
      );
    });

    test('Supplier Product provenance follows the mapping effective at cost time', async () => {
      const specA =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Supplier Spec A'
        );

      const specB =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Supplier Spec B'
        );

      const supplierProductId =
        await createSupplierProduct(
          ctx,
          specA,
          '2026-08-10T12:00:00Z'
        );

      expect(
        (
          await recordCost(
            ctx,
            {
              purchaseSpecificationId:
                specA,
              unitCost: '11',
              sourceKind:
                'supplier_product',
              supplierProductId,
              effectiveFrom:
                '2026-08-15T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();

      await addSupplierProductMappingVersion(
        ctx,
        supplierProductId,
        specB,
        '2026-08-20T12:00:00Z'
      );

      expect(
        (
          await recordCost(
            ctx,
            {
              purchaseSpecificationId:
                specA,
              unitCost: '12',
              sourceKind:
                'supplier_product',
              supplierProductId,
              effectiveFrom:
                '2026-08-21T12:00:00Z'
            }
          )
        ).error
      ).not.toBeNull();

      expect(
        (
          await recordCost(
            ctx,
            {
              purchaseSpecificationId:
                specB,
              unitCost: '13',
              sourceKind:
                'supplier_product',
              supplierProductId,
              effectiveFrom:
                '2026-08-21T12:00:00Z'
            }
          )
        ).error
      ).toBeNull();
    });

    test('rejects Supplier Product provenance before any mapping is effective', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Future Supplier Mapping'
        );

      const supplierProductId =
        await createSupplierProduct(
          ctx,
          specId,
          '2026-08-20T12:00:00Z'
        );

      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            unitCost: '7',
            sourceKind:
              'supplier_product',
            supplierProductId,
            effectiveFrom:
              '2026-08-15T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('organization cost read permission exposes organization cost history', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const { data, error } =
        await client
          .from(
            'ingredient_purchase_specification_cost_observations'
          )
          .select('id')
          .eq(
            'purchase_specification_id',
            baseSpecId
          );

      expect(error).toBeNull();
      expect(
        (data ?? []).length
      ).toBeGreaterThan(0);
    });

    test('location-scoped cost read does not inherit organization read', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user2Token
        );

      const { data, error } =
        await client
          .from(
            'ingredient_purchase_specification_cost_observations'
          )
          .select('id')
          .eq(
            'organization_id',
            ctx.org1Id
          );

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('authenticated client cannot directly mutate cost history or execute service command', async () => {
      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const insertResult =
        await client
          .from(
            'ingredient_purchase_specification_cost_observations'
          )
          .insert({
            organization_id:
              ctx.org1Id,
            purchase_specification_id:
              baseSpecId,
            value_state: 'known',
            unit_cost: '5',
            currency: 'USD',
            source_kind: 'manual',
            supplier_product_id: null,
            effective_from:
              '2026-08-25T12:00:00Z'
          });

      expect(
        insertResult.error
      ).not.toBeNull();

      const rpcResult =
        await client.rpc(
          'm2_record_purchase_specification_cost',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_purchase_specification_id:
              baseSpecId,
            p_value_state: 'known',
            p_unit_cost: '5',
            p_currency: 'USD',
            p_source_kind: 'manual',
            p_supplier_product_id: null,
            p_effective_from:
              '2026-08-26T12:00:00Z',
            p_correlation_id:
              randomUUID()
          }
        );

      expect(
        rpcResult.error
      ).not.toBeNull();
    });

    test('organization A manager cannot manage cost in organization B', async () => {
      const { error } =
        await recordCost(
          ctx,
          {
            organizationId:
              ctx.org2Id,
            purchaseSpecificationId:
              baseSpecId,
            effectiveFrom:
              '2026-08-27T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects cost for archived Purchase Specification', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Archived Spec'
        );

      localSql(`
        update public.ingredient_purchase_specifications
        set
          lifecycle_status = 'archived',
          archived_at = now()
        where id = '${specId}';
      `);

      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            effectiveFrom:
              '2026-08-28T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects cost for Purchase Specification whose Ingredient is archived', async () => {
      const ingredientId =
        '550e8400-e29b-41d4-a716-446655444120';

      const specId =
        '550e8400-e29b-41d4-a716-446655444121';

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
          '${ingredientId}',
          '${ctx.org1Id}',
          'M2-I04 Archived Ingredient',
          'g',
          'archived',
          now()
        );

        insert into public.ingredient_purchase_specifications (
          id,
          organization_id,
          ingredient_id,
          lifecycle_status
        )
        values (
          '${specId}',
          '${ctx.org1Id}',
          '${ingredientId}',
          'active'
        );
      `);

      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            effectiveFrom:
              '2026-08-29T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('rejects new Supplier Product cost provenance after Supplier Product archive', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Archived Supplier Product'
        );

      const supplierProductId =
        await createSupplierProduct(
          ctx,
          specId,
          '2026-08-10T12:00:00Z'
        );

      localSql(`
        update public.ingredient_supplier_products
        set
          lifecycle_status = 'archived',
          archived_at = now()
        where id =
          '${supplierProductId}';
      `);

      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            sourceKind:
              'supplier_product',
            supplierProductId,
            effectiveFrom:
              '2026-08-30T12:00:00Z'
          }
        );

      expect(error).not.toBeNull();
    });

    test('successful cost record produces financial_security F39 audit evidence', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Audit Spec'
        );

      const correlationId =
        randomUUID();

      const { error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            unitCost: '8.75',
            currency: 'USD',
            effectiveFrom:
              '2026-08-31T12:00:00Z',
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
        'm2.cost.record|financial_security'
      );
    });

    test('cost history rejects update and delete even through postgres', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'M2-I04 Immutable Cost Spec'
        );

      const { data, error } =
        await recordCost(
          ctx,
          {
            purchaseSpecificationId:
              specId,
            unitCost: '9',
            effectiveFrom:
              '2026-09-01T12:00:00Z'
          }
        );

      expect(error).toBeNull();
      expect(data).toBeTruthy();

      expect(() =>
        localSql(`
          update public.ingredient_purchase_specification_cost_observations
          set unit_cost = '99'
          where id = '${data}';
        `)
      ).toThrow();

      expect(() =>
        localSql(`
          delete from public.ingredient_purchase_specification_cost_observations
          where id = '${data}';
        `)
      ).toThrow();
    });

    test('Ingredient schema contains no implicit preferred or current cost', () => {
      const forbiddenCount =
        localQuery(`
          select count(*)
          from information_schema.columns
          where table_schema = 'public'
            and table_name = 'ingredients'
            and column_name in (
              'current_cost',
              'effective_cost',
              'preferred_cost',
              'preferred_purchase_specification_id',
              'preferred_supplier_product_id'
            );
        `);

      expect(forbiddenCount)
        .toBe('0');
    });
  }
);
