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
  user2AuthId: string;
  user2AppId: UUID;
  user2Token: string;
}

async function createTestUser(
  publicClient: SupabaseClient,
  label: string
) {
  const email =
    `m2-i03-${label}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}@test.local`;

  const { data, error } =
    await publicClient.auth.signUp({
      email,
      password: 'M2I03-Test-Password-123!'
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
    '550e8400-e29b-41d4-a716-446655442001' as UUID;
  const org2Id =
    '550e8400-e29b-41d4-a716-446655442002' as UUID;
  const location1Id =
    '550e8400-e29b-41d4-a716-446655442003' as UUID;
  const ingredient1Id =
    '550e8400-e29b-41d4-a716-446655442004' as UUID;

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
      'M2-I03 Ingredient',
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
      ('manager', 'm2.vendor_mapping.read'),
      ('manager', 'm2.vendor_mapping.manage'),
      ('staff', 'm2.vendor_mapping.read')
    on conflict do nothing;
  `);

  const user1 =
    await createTestUser(
      publicClient,
      'manager'
    );

  const user2 =
    await createTestUser(
      publicClient,
      'location-reader'
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
    serverClient,
    publicClient,
    org1Id,
    org2Id,
    location1Id,
    ingredient1Id,
    user1AuthId: user1.authId,
    user1AppId: identity1.userId,
    user1Token: user1.token,
    user2AuthId: user2.authId,
    user2AppId: identity2.userId,
    user2Token: user2.token
  };
}

async function createPurchaseSpec(
  ctx: TestContext,
  label: string,
  correlationId: string
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
          '2026-08-19T12:00:00Z',
        p_package_labels:
          ['case'],
        p_units_per_parent:
          [null],
        p_terminal_quantity:
          '100',
        p_terminal_unit:
          'g',
        p_correlation_id:
          correlationId
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
  sourceNamespace: string,
  externalId: string,
  correlationId: string
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
          sourceNamespace,
        p_external_id:
          externalId,
        p_purchase_specification_id:
          purchaseSpecificationId,
        p_effective_from:
          '2026-08-19T13:00:00Z',
        p_correlation_id:
          correlationId
      }
    );

  if (error || !data) {
    throw new Error(
      `Failed to create Supplier Product: ${error?.message}`
    );
  }

  return data as string;
}

testFn(
  'M2-I03 Supplier Product Mapping integration',
  () => {
    let ctx: TestContext;

    beforeAll(async () => {
      ctx = await setupContext();
    }, 30000);

    test('creates Supplier Product, initial mapping and Foundation external registration', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 External Registration',
          '550e8400-e29b-41d4-a716-446655442101'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'vendor_erp',
          '00123-AbC/42',
          '550e8400-e29b-41d4-a716-446655442102'
        );

      const { data: product, error } =
        await ctx.serverClient
          .from('ingredient_supplier_products')
          .select('*')
          .eq('id', productId)
          .single();

      expect(error).toBeNull();
      expect(product?.organization_id)
        .toBe(ctx.org1Id);
      expect(product?.source_namespace)
        .toBe('vendor_erp');
      expect(product?.external_id)
        .toBe('00123-AbC/42');
      expect(product?.lifecycle_status)
        .toBe('active');

      const { data: mappings } =
        await ctx.serverClient
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .select('*')
          .eq(
            'supplier_product_id',
            productId
          );

      expect(mappings).toHaveLength(1);
      expect(mappings?.[0]?.version_number)
        .toBe(1);
      expect(
        mappings?.[0]?.purchase_specification_id
      ).toBe(specId);
      expect(
        mappings?.[0]?.supersedes_mapping_id
      ).toBeNull();

      const registration =
        localQuery(`
          select
            source_namespace
            || '|' ||
            external_id
            || '|' ||
            kitchen_iq_id::text
          from private.external_identifier_mappings
          where source_namespace = 'vendor_erp'
            and external_id = '00123-AbC/42';
        `);

      expect(registration)
        .toBe(
          `vendor_erp|00123-AbC/42|${productId}`
        );
    });

    test('preserves leading zeros and case as distinct external identity', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Opaque Identity',
          '550e8400-e29b-41d4-a716-446655442103'
        );

      const zeroId =
        await createSupplierProduct(
          ctx,
          specId,
          'vendor_case_test',
          '00123',
          '550e8400-e29b-41d4-a716-446655442104'
        );

      const plainId =
        await createSupplierProduct(
          ctx,
          specId,
          'vendor_case_test',
          '123',
          '550e8400-e29b-41d4-a716-446655442105'
        );

      const upperId =
        await createSupplierProduct(
          ctx,
          specId,
          'vendor_case_test',
          'ABC',
          '550e8400-e29b-41d4-a716-446655442106'
        );

      const lowerId =
        await createSupplierProduct(
          ctx,
          specId,
          'vendor_case_test',
          'abc',
          '550e8400-e29b-41d4-a716-446655442107'
        );

      expect(new Set([
        zeroId,
        plainId,
        upperId,
        lowerId
      ]).size).toBe(4);

      const values =
        localQuery(`
          select string_agg(
            external_id,
            ','
            order by external_id
          )
          from private.external_identifier_mappings
          where source_namespace =
            'vendor_case_test';
        `);

      expect(values).toContain('00123');
      expect(values).toContain('123');
      expect(values).toContain('ABC');
      expect(values).toContain('abc');
    });

    test('Foundation external identity collision rolls back M2 creation atomically', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Collision',
          '550e8400-e29b-41d4-a716-446655442108'
        );

      localSql(`
        insert into private.external_identifier_mappings (
          source_namespace,
          external_id,
          kitchen_iq_id
        )
        values (
          'preexisting_source',
          '000999',
          '550e8400-e29b-41d4-a716-446655442099'
        );
      `);

      const correlationId =
        '550e8400-e29b-41d4-a716-446655442109';

      const { error } =
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
              'preexisting_source',
            p_external_id:
              '000999',
            p_purchase_specification_id:
              specId,
            p_effective_from:
              '2026-08-19T13:00:00Z',
            p_correlation_id:
              correlationId
          }
        );

      expect(error).toBeTruthy();

      expect(
        localQuery(`
          select count(*)
          from public.ingredient_supplier_products
          where source_namespace =
            'preexisting_source'
            and external_id = '000999';
        `)
      ).toBe('0');

      expect(
        localQuery(`
          select count(*)
          from private.audit_records
          where correlation_id =
            '${correlationId}';
        `)
      ).toBe('0');
    });

    test('appends immutable mapping version and preserves predecessor', async () => {
      const spec1 =
        await createPurchaseSpec(
          ctx,
          'I03 Mapping A',
          '550e8400-e29b-41d4-a716-446655442110'
        );

      const spec2 =
        await createPurchaseSpec(
          ctx,
          'I03 Mapping B',
          '550e8400-e29b-41d4-a716-446655442111'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          spec1,
          'mapping_version_test',
          'SKU-1',
          '550e8400-e29b-41d4-a716-446655442112'
        );

      const { data: first } =
        await ctx.serverClient
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .select('*')
          .eq(
            'supplier_product_id',
            productId
          )
          .single();

      const { data: secondId, error } =
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
              productId,
            p_purchase_specification_id:
              spec2,
            p_effective_from:
              '2026-08-20T13:00:00Z',
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442113'
          }
        );

      expect(error).toBeNull();

      const { data: second } =
        await ctx.serverClient
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .select('*')
          .eq('id', secondId)
          .single();

      expect(second?.version_number).toBe(2);
      expect(second?.supersedes_mapping_id)
        .toBe(first?.id);
      expect(second?.purchase_specification_id)
        .toBe(spec2);

      const { data: firstAgain } =
        await ctx.serverClient
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .select('*')
          .eq('id', first?.id)
          .single();

      expect(firstAgain?.version_number).toBe(1);
      expect(firstAgain?.purchase_specification_id)
        .toBe(spec1);
    });

    test('rejects mapping version that does not move effective time forward', async () => {
      const spec1 =
        await createPurchaseSpec(
          ctx,
          'I03 Time A',
          '550e8400-e29b-41d4-a716-446655442114'
        );

      const spec2 =
        await createPurchaseSpec(
          ctx,
          'I03 Time B',
          '550e8400-e29b-41d4-a716-446655442115'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          spec1,
          'mapping_time_test',
          'SKU-2',
          '550e8400-e29b-41d4-a716-446655442116'
        );

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
              productId,
            p_purchase_specification_id:
              spec2,
            p_effective_from:
              '2026-08-19T12:00:00Z',
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442117'
          }
        );

      expect(error).toBeTruthy();
      expect(error?.message).toContain(
        'effective_from must be later'
      );
    });

    test('rejects redundant mapping version to same Purchase Specification', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Same Spec',
          '550e8400-e29b-41d4-a716-446655442118'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'same_spec_test',
          'SKU-3',
          '550e8400-e29b-41d4-a716-446655442119'
        );

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
              productId,
            p_purchase_specification_id:
              specId,
            p_effective_from:
              '2026-08-20T13:00:00Z',
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442120'
          }
        );

      expect(error).toBeTruthy();
      expect(error?.message).toContain(
        'must change the Purchase Specification'
      );
    });

    test('organization read permission exposes Supplier Product and mapping', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 RLS Org',
          '550e8400-e29b-41d4-a716-446655442121'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'rls_org',
          'SKU-4',
          '550e8400-e29b-41d4-a716-446655442122'
        );

      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const productResult =
        await client
          .from('ingredient_supplier_products')
          .select('id')
          .eq('id', productId);

      expect(productResult.error).toBeNull();
      expect(productResult.data)
        .toHaveLength(1);

      const mappingResult =
        await client
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .select('id')
          .eq(
            'supplier_product_id',
            productId
          );

      expect(mappingResult.error).toBeNull();
      expect(mappingResult.data)
        .toHaveLength(1);
    });

    test('location-scoped read does not inherit organization Supplier Product read', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Location Scope',
          '550e8400-e29b-41d4-a716-446655442123'
        );

      await createSupplierProduct(
        ctx,
        specId,
        'location_scope',
        'SKU-5',
        '550e8400-e29b-41d4-a716-446655442124'
      );

      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user2Token
        );

      const { data, error } =
        await client
          .from('ingredient_supplier_products')
          .select('*')
          .eq(
            'organization_id',
            ctx.org1Id
          );

      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    test('authenticated client cannot directly mutate Supplier Product or mapping history', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Direct DML',
          '550e8400-e29b-41d4-a716-446655442125'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'direct_dml',
          'SKU-6',
          '550e8400-e29b-41d4-a716-446655442126'
        );

      const client =
        authenticatedClient(
          ctx.publicConfig.url,
          ctx.publicConfig.publicKey,
          ctx.user1Token
        );

      const insertResult =
        await client
          .from('ingredient_supplier_products')
          .insert({
            organization_id:
              ctx.org1Id,
            source_namespace:
              'illegal',
            external_id:
              'illegal',
            lifecycle_status:
              'active'
          });

      expect(insertResult.error).toBeTruthy();

      const updateResult =
        await client
          .from('ingredient_supplier_products')
          .update({
            lifecycle_status:
              'inactive'
          })
          .eq('id', productId);

      expect(updateResult.error).toBeTruthy();

      const deleteResult =
        await client
          .from(
            'ingredient_supplier_product_purchase_specification_mappings'
          )
          .delete()
          .eq(
            'supplier_product_id',
            productId
          );

      expect(deleteResult.error).toBeTruthy();
    });

    test('organization A manager cannot manage Supplier Product in organization B', async () => {
      const { error } =
        await ctx.serverClient.rpc(
          'm2_create_supplier_product_mapping',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org2Id,
            p_source_namespace:
              'cross_org',
            p_external_id:
              'SKU-7',
            p_purchase_specification_id:
              '550e8400-e29b-41d4-a716-446655442199',
            p_effective_from:
              '2026-08-19T13:00:00Z',
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442127'
          }
        );

      expect(error).toBeTruthy();
      expect(error?.message)
        .toContain('not authorized');
    });

    test('archive requires AAL2 and retains mapping and external identity', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Archive',
          '550e8400-e29b-41d4-a716-446655442128'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'archive_test',
          '000888',
          '550e8400-e29b-41d4-a716-446655442129'
        );

      const aal1 =
        await ctx.serverClient.rpc(
          'm2_archive_supplier_product',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal1',
            p_organization_id:
              ctx.org1Id,
            p_supplier_product_id:
              productId,
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442130'
          }
        );

      expect(aal1.error).toBeTruthy();
      expect(aal1.error?.message)
        .toContain('requires aal2');

      const aal2 =
        await ctx.serverClient.rpc(
          'm2_archive_supplier_product',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal2',
            p_organization_id:
              ctx.org1Id,
            p_supplier_product_id:
              productId,
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442131'
          }
        );

      expect(aal2.error).toBeNull();

      const { data: product } =
        await ctx.serverClient
          .from('ingredient_supplier_products')
          .select('*')
          .eq('id', productId)
          .single();

      expect(product?.lifecycle_status)
        .toBe('archived');
      expect(product?.archived_at)
        .toBeTruthy();

      const mappingCount =
        localQuery(`
          select count(*)
          from public.ingredient_supplier_product_purchase_specification_mappings
          where supplier_product_id =
            '${productId}';
        `);

      expect(mappingCount).toBe('1');

      const externalCount =
        localQuery(`
          select count(*)
          from private.external_identifier_mappings
          where source_namespace =
            'archive_test'
            and external_id =
              '000888'
            and kitchen_iq_id =
              '${productId}';
        `);

      expect(externalCount).toBe('1');
    });

    test('archived Supplier Product cannot receive new mapping version', async () => {
      const spec1 =
        await createPurchaseSpec(
          ctx,
          'I03 Archived Product A',
          '550e8400-e29b-41d4-a716-446655442132'
        );

      const spec2 =
        await createPurchaseSpec(
          ctx,
          'I03 Archived Product B',
          '550e8400-e29b-41d4-a716-446655442133'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          spec1,
          'archived_remap',
          'SKU-8',
          '550e8400-e29b-41d4-a716-446655442134'
        );

      const archive =
        await ctx.serverClient.rpc(
          'm2_archive_supplier_product',
          {
            p_auth_principal_id:
              ctx.user1AuthId,
            p_application_user_id:
              ctx.user1AppId,
            p_aal: 'aal2',
            p_organization_id:
              ctx.org1Id,
            p_supplier_product_id:
              productId,
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442135'
          }
        );

      expect(archive.error).toBeNull();

      const remap =
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
              productId,
            p_purchase_specification_id:
              spec2,
            p_effective_from:
              '2026-08-20T13:00:00Z',
            p_correlation_id:
              '550e8400-e29b-41d4-a716-446655442136'
          }
        );

      expect(remap.error).toBeTruthy();
      expect(remap.error?.message)
        .toContain(
          'cannot remap archived Supplier Product'
        );
    });

    test('successful creation produces F39 audit evidence', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Audit',
          '550e8400-e29b-41d4-a716-446655442137'
        );

      const correlationId =
        '550e8400-e29b-41d4-a716-446655442138';

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'audit_source',
          '000777',
          correlationId
        );

      const audit = JSON.parse(
        localQuery(`
          select row_to_json(record)
          from private.audit_records as record
          where correlation_id =
            '${correlationId}';
        `)
      );

      expect(audit.action)
        .toBe('m2.vendor_mapping.create');
      expect(audit.target_kind)
        .toBe('ingredient_supplier_product');
      expect(audit.target_id)
        .toBe(productId);
      expect(audit.organization_id)
        .toBe(ctx.org1Id);
      expect(audit.scope_kind)
        .toBe('organization');
      expect(audit.retention_profile)
        .toBe('protected_operational');
    });

    test('mapping history rejects update and delete even through postgres', async () => {
      const specId =
        await createPurchaseSpec(
          ctx,
          'I03 Immutable',
          '550e8400-e29b-41d4-a716-446655442139'
        );

      const productId =
        await createSupplierProduct(
          ctx,
          specId,
          'immutable_test',
          'SKU-9',
          '550e8400-e29b-41d4-a716-446655442140'
        );

      const mappingId =
        localQuery(`
          select id
          from public.ingredient_supplier_product_purchase_specification_mappings
          where supplier_product_id =
            '${productId}'
          limit 1;
        `);

      expect(() =>
        localSql(`
          update public.ingredient_supplier_product_purchase_specification_mappings
          set effective_from =
            '2027-01-01T00:00:00Z'
          where id = '${mappingId}';
        `)
      ).toThrow();

      expect(() =>
        localSql(`
          delete
          from public.ingredient_supplier_product_purchase_specification_mappings
          where id = '${mappingId}';
        `)
      ).toThrow();
    });

    test('M2 Supplier Product contains no Supplier-master relational identity', () => {
      const columns =
        localQuery(`
          select string_agg(
            column_name,
            ','
            order by column_name
          )
          from information_schema.columns
          where table_schema = 'public'
            and table_name =
              'ingredient_supplier_products';
        `);

      expect(columns)
        .not.toContain('supplier_id');
      expect(columns)
        .not.toContain('vendor_id');
      expect(columns)
        .not.toContain('supplier_name');
      expect(columns)
        .not.toContain('vendor_name');
    });
  }
);
