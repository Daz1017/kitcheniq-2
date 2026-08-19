/**
 * M2-I01 Integration Tests
 *
 * Tests database operations, RLS, permissions, and audit trails for Ingredient.
 * These tests require a running Supabase instance with migrations applied and
 * proper authentication configuration.
 *
 * To run these tests:
 * 1. npm run db:reset
 * 2. Export KITCHENIQ_SUPABASE_URL, KITCHENIQ_SUPABASE_PUBLIC_KEY, KITCHENIQ_SUPABASE_SECRET_KEY
 * 3. npm run test -- tests/integration/
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  loadSupabasePublicConfig,
  loadSupabaseServerConfig,
  resolveAuthenticatedApplicationUser
} from '../../../src/foundation/runtime';
import type { UUID } from '../../../src/foundation/identifiers';

// Skip all tests if required environment variables are not set
const skip = !process.env.KITCHENIQ_SUPABASE_URL || 
             !process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY ||
             !process.env.KITCHENIQ_SUPABASE_SECRET_KEY;

const testFn = skip ? describe.skip : describe;

interface TestContext {
  publicConfig: ReturnType<typeof loadSupabasePublicConfig>;
  serverConfig: ReturnType<typeof loadSupabaseServerConfig>;
  publicClient: SupabaseClient;
  serverClient: SupabaseClient;
  org1Id: UUID;
  org2Id: UUID;
  location1Id: UUID;
  user1AuthId: string;
  user1AppId: UUID;
  user1Token: string;
  user2AuthId: string;
  user2AppId: UUID;
  user2Token: string;
}

async function createTestUser(publicClient: SupabaseClient, label: string) {
  const email = `m2-i01-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@test.local`;
  const { data, error } = await publicClient.auth.signUp({
    email,
    password: 'M2I01-Test-Password-123!'
  });

  if (error || !data.user?.id || !data.session?.access_token) {
    throw new Error(`Failed to create test user ${label}: ${error?.message}`);
  }

  return {
    authId: data.user.id as string,
    token: data.session.access_token,
    email
  };
}

async function setupContext(): Promise<TestContext> {
  const publicConfig = loadSupabasePublicConfig({
    KITCHENIQ_SUPABASE_URL: process.env.KITCHENIQ_SUPABASE_URL ?? 'http://127.0.0.1:54321',
    KITCHENIQ_SUPABASE_PUBLIC_KEY: process.env.KITCHENIQ_SUPABASE_PUBLIC_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1enp5LXNwYWNlLWd1aWRlLTRxcXFwNHJ4dmo5ajM3NDk1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTI0NzIwMDAsImV4cCI6MTg1MDIzODAwMH0.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
  });

  const serverConfig = loadSupabaseServerConfig({
    KITCHENIQ_SUPABASE_URL: publicConfig.url,
    KITCHENIQ_SUPABASE_PUBLIC_KEY: publicConfig.publicKey,
    KITCHENIQ_SUPABASE_SECRET_KEY: process.env.KITCHENIQ_SUPABASE_SECRET_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTY5MjQ3MjAwMCwiZXhwIjoxODUwMjM4MDB9.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  });

  const publicClient = createClient(publicConfig.url, publicConfig.publicKey);
  const serverClient = createClient(serverConfig.url, serverConfig.secretKey);

  // Create test organizations
  const { data: org1Data, error: org1Error } = await serverClient.from('organizations').insert({}).select('id').single();
  if (org1Error) throw new Error(`Failed to create org1: ${org1Error.message}`);
  const org1Id = org1Data.id as UUID;

  const { data: org2Data, error: org2Error } = await serverClient.from('organizations').insert({}).select('id').single();
  if (org2Error) throw new Error(`Failed to create org2: ${org2Error.message}`);
  const org2Id = org2Data.id as UUID;

  // Create test location in org1
  const { data: loc1Data, error: loc1Error } = await serverClient
    .from('locations')
    .insert({ organization_id: org1Id })
    .select('id')
    .single();
  if (loc1Error) throw new Error(`Failed to create location: ${loc1Error.message}`);
  const location1Id = loc1Data.id as UUID;

  // Create test users
  const user1 = await createTestUser(publicClient, 'user1');
  const user2 = await createTestUser(publicClient, 'user2');

  // Resolve application user identities
  const user1Identity = await resolveAuthenticatedApplicationUser(user1.token, publicConfig);
  const user2Identity = await resolveAuthenticatedApplicationUser(user2.token, publicConfig);

  // Create role assignments for testing
  // User1: owner at org1 (should have all permissions)
  await serverClient.from('role_assignments').insert({
    application_user_id: user1Identity.userId,
    role_class: 'owner',
    scope_kind: 'organization',
    organization_id: org1Id,
    location_id: null
  });

  // User2: staff at location1 (location-scoped, should not have org permissions)
  await serverClient.from('role_assignments').insert({
    application_user_id: user2Identity.userId,
    role_class: 'staff',
    scope_kind: 'location',
    organization_id: org1Id,
    location_id: location1Id
  });

  return {
    publicConfig,
    serverConfig,
    publicClient,
    serverClient,
    org1Id,
    org2Id,
    location1Id,
    user1AuthId: user1.authId,
    user1AppId: user1Identity.userId,
    user1Token: user1.token,
    user2AuthId: user2.authId,
    user2AppId: user2Identity.userId,
    user2Token: user2.token
  };
}

testFn('M2-I01 Integration Tests', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await setupContext();
  }, 30000); // 30s timeout for setup

  describe('Migration and database structure', () => {
    test('public.ingredients table exists', async () => {
      const { data, error } = await ctx.serverClient
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', 'ingredients')
        .single();

      expect(error).toBeNull();
      expect(data?.table_name).toBe('ingredients');
    });

    test('ingredients table has required columns', async () => {
      const { data: columns, error } = await ctx.serverClient.rpc('get_table_columns', {
        schema_name: 'public',
        table_name: 'ingredients'
      });

      expect(error).toBeNull();

      const columnNames = (columns as Array<{ column_name: string }>).map((c) => c.column_name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('organization_id');
      expect(columnNames).toContain('display_name');
      expect(columnNames).toContain('description');
      expect(columnNames).toContain('base_canonical_unit');
      expect(columnNames).toContain('lifecycle_status');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
      expect(columnNames).toContain('archived_at');
    });

    test('Module 2 Ingredient permissions exist', async () => {
      const { data, error } = await ctx.serverClient
        .from('permissions')
        .select('id')
        .or(
          "id.eq.m2.ingredient.read,id.eq.m2.ingredient.create,id.eq.m2.ingredient.update,id.eq.m2.ingredient.archive"
        );

      expect(error).toBeNull();
      const permIds = (data as Array<{ id: string }>).map((p) => p.id);
      expect(permIds).toContain('m2.ingredient.read');
      expect(permIds).toContain('m2.ingredient.create');
      expect(permIds).toContain('m2.ingredient.update');
      expect(permIds).toContain('m2.ingredient.archive');
    });
  });

  describe('Create ingredient command', () => {
    test('creates ingredient with valid parameters', async () => {
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Shrimp',
        p_description: 'A type of shellfish',
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440000'
      });

      expect(ingredientId.error).toBeNull();
      expect(ingredientId.data).toBeTruthy();

      // Verify ingredient was created
      const { data: ingredient, error: readError } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('id', ingredientId.data)
        .single();

      expect(readError).toBeNull();
      expect(ingredient?.display_name).toBe('Shrimp');
      expect(ingredient?.description).toBe('A type of shellfish');
      expect(ingredient?.base_canonical_unit).toBe('g');
      expect(ingredient?.lifecycle_status).toBe('active');
      expect(ingredient?.organization_id).toBe(ctx.org1Id);
      expect(ingredient?.archived_at).toBeNull();
    });

    test('creates ingredient with null description', async () => {
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Salt',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440001'
      });

      expect(ingredientId.error).toBeNull();

      const { data: ingredient } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('id', ingredientId.data)
        .single();

      expect(ingredient?.description).toBeNull();
    });

    test('rejects duplicate display name within organization', async () => {
      const corrId1 = '550e8400-e29b-41d4-a716-446655440010';
      const corrId2 = '550e8400-e29b-41d4-a716-446655440011';

      // Create first ingredient
      await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Garlic',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: corrId1
      });

      // Try to create duplicate
      const duplicate = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Garlic',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: corrId2
      });

      expect(duplicate.error).toBeTruthy();
      expect(duplicate.error?.message).toContain('already exists');
    });

    test('trims display name on create', async () => {
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: '  Pepper  ',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440020'
      });

      expect(ingredientId.error).toBeNull();

      const { data: ingredient } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('id', ingredientId.data)
        .single();

      expect(ingredient?.display_name).toBe('Pepper');
    });

    test('creates audit record on successful create', async () => {
      const corrId = '550e8400-e29b-41d4-a716-446655440030';
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Onion',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: corrId
      });

      const { data: audit } = await ctx.serverClient
        .from('audit_records')
        .select('*')
        .eq('correlation_id', corrId)
        .eq('target_kind', 'ingredient')
        .single();

      expect(audit?.action).toBe('m2.ingredient.create');
      expect(audit?.target_id).toBe(ingredientId.data);
      expect(audit?.organization_id).toBe(ctx.org1Id);
      expect(audit?.scope_kind).toBe('organization');
      expect(audit?.retention_profile).toBe('protected_operational');
    });
  });

  describe('RLS and authorization', () => {
    test('authenticated user without permission cannot read ingredients', async () => {
      // Create a user with no role assignment
      const newUser = await createTestUser(ctx.publicClient, 'unauth');
      const newUserIdentity = await resolveAuthenticatedApplicationUser(newUser.token, ctx.publicConfig);

      const clientWithNoAuth = createClient(ctx.publicConfig.url, newUser.token);
      const { data: ingredients, error } = await clientWithNoAuth.from('ingredients').select('*').eq('organization_id', ctx.org1Id);

      expect(error).toBeNull();
      expect(ingredients).toEqual([]);
    });

    test('location-scoped permission does not grant organization-scoped read', async () => {
      // User2 has location-scoped staff role only
      const clientWithLocationAuth = createClient(ctx.publicConfig.url, ctx.user2Token);

      // Create an ingredient first (using server client)
      await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Oil',
        p_description: null,
        p_base_canonical_unit: 'mL',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440040'
      });

      // User2 tries to read (should fail due to RLS)
      const { data: ingredients, error } = await clientWithLocationAuth
        .from('ingredients')
        .select('*')
        .eq('organization_id', ctx.org1Id);

      expect(error).toBeNull();
      expect(ingredients).toEqual([]);
    });

    test('authenticated user cannot directly INSERT ingredient', async () => {
      const clientWithAuth = createClient(ctx.publicConfig.url, ctx.user1Token);

      const { data, error } = await clientWithAuth.from('ingredients').insert({
        organization_id: ctx.org1Id,
        display_name: 'Illegal Direct Insert',
        description: null,
        base_canonical_unit: 'g',
        lifecycle_status: 'active'
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('permission denied');
    });

    test('authenticated user cannot directly UPDATE ingredient', async () => {
      // Create via server command
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Milk',
        p_description: null,
        p_base_canonical_unit: 'mL',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440050'
      });

      const clientWithAuth = createClient(ctx.publicConfig.url, ctx.user1Token);

      const { data, error } = await clientWithAuth
        .from('ingredients')
        .update({ display_name: 'Illegally Updated' })
        .eq('id', ingredientId.data);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('permission denied');
    });

    test('authenticated user cannot directly DELETE ingredient', async () => {
      // Create via server command
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Cheese',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440060'
      });

      const clientWithAuth = createClient(ctx.publicConfig.url, ctx.user1Token);

      const { data, error } = await clientWithAuth.from('ingredients').delete().eq('id', ingredientId.data);

      expect(error).toBeTruthy();
      expect(error?.message).toContain('permission denied');
    });
  });

  describe('Organization scope isolation', () => {
    test('ingredient in org1 is isolated from org2', async () => {
      // Create ingredient in org1
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Org1 Ingredient',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440070'
      });

      // Try to read from org2 via direct query (should fail)
      const { data } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('organization_id', ctx.org2Id);

      expect(data).toEqual([]);

      // Verify ingredient exists in org1
      const { data: org1Ing } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('organization_id', ctx.org1Id)
        .eq('id', ingredientId.data)
        .single();

      expect(org1Ing).toBeTruthy();
    });
  });

  describe('Archive command', () => {
    test('requires AAL2 to archive', async () => {
      // Create ingredient
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Archive Test',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440080'
      });

      // Try to archive with AAL1 (should fail)
      const { error } = await ctx.serverClient.rpc('m2_archive_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ingredientId.data,
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440081'
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('aal2');
    });

    test('archives ingredient with AAL2', async () => {
      // Create ingredient
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Archive With AAL2',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440090'
      });

      // Archive with AAL2
      const archiveResult = await ctx.serverClient.rpc('m2_archive_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal2',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ingredientId.data,
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440091'
      });

      expect(archiveResult.error).toBeNull();

      // Verify archived
      const { data: ingredient } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('id', ingredientId.data)
        .single();

      expect(ingredient?.lifecycle_status).toBe('archived');
      expect(ingredient?.archived_at).toBeTruthy();
    });

    test('cannot archive already archived ingredient', async () => {
      // Create and archive
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Double Archive Test',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440100'
      });

      await ctx.serverClient.rpc('m2_archive_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal2',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ingredientId.data,
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440101'
      });

      // Try to archive again
      const { error } = await ctx.serverClient.rpc('m2_archive_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal2',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ingredientId.data,
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440102'
      });

      expect(error).toBeTruthy();
      expect(error?.message).toContain('already archived');
    });

    test('archived ingredient is not physically deleted', async () => {
      // Create and archive
      const ingredientId = await ctx.serverClient.rpc('m2_create_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal1',
        p_organization_id: ctx.org1Id,
        p_display_name: 'Not Deleted',
        p_description: null,
        p_base_canonical_unit: 'g',
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440110'
      });

      await ctx.serverClient.rpc('m2_archive_ingredient', {
        p_auth_principal_id: ctx.user1AuthId,
        p_application_user_id: ctx.user1AppId,
        p_aal: 'aal2',
        p_organization_id: ctx.org1Id,
        p_ingredient_id: ingredientId.data,
        p_correlation_id: '550e8400-e29b-41d4-a716-446655440111'
      });

      // Row still exists
      const { data: ingredient, error } = await ctx.serverClient
        .from('ingredients')
        .select('*')
        .eq('id', ingredientId.data)
        .single();

      expect(error).toBeNull();
      expect(ingredient).toBeTruthy();
      expect(ingredient?.lifecycle_status).toBe('archived');
    });
  });
});
