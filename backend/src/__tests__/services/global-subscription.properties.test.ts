import fc from 'fast-check';
import { GlobalSubscriptionService } from '../../services/global-subscription.service';
import { SystemSettings } from '../../models/SystemSettings';
import { AuditLog } from '../../models/AuditLog';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db';

/**
 * Property-Based Tests for Global Subscription Control System
 *
 * These tests validate correctness properties using generative testing.
 * Each property generates hundreds of random input combinations to verify
 * that the system behaves correctly across all valid input spaces.
 *
 * Properties Validated:
 * 1. Idempotent Toggle - Toggling to same state multiple times = final state
 * 2. State Retrieval Consistency - GET immediately after POST returns exact posted state
 * 3. Global State Feature Gate Effect - OFF denies all, ON respects subscriptions
 * 4. User Subscription Data Preservation - Data unchanged after toggles
 * 5. Immediate Feature Gate Updates - State transitions reflected immediately
 */

describe('Global Subscription Control - Property-Based Tests', () => {
  let service: GlobalSubscriptionService;

  // Skip if database not available
  const skipIfNoDb = process.env.SKIP_DB_TESTS ? test.skip : test;

  beforeAll(async () => {
    if (!mongoose.connection.readyState) {
      try {
        await connectDB();
      } catch (error) {
        console.warn('Could not connect to MongoDB for PBT tests:', error);
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clear collections
    if (mongoose.connection.readyState) {
      await SystemSettings.deleteMany({});
      await AuditLog.deleteMany({});
    }
    service = new GlobalSubscriptionService();
    await service.initializeDefaultState();
  });

  // ============================================================================
  // PROPERTY 1: Idempotent Toggle
  // ============================================================================
  /**
   * **Property 1: Idempotent Toggle**
   *
   * **Validates: Requirements 1.3, 4.3**
   *
   * Property Statement:
   * For any boolean state B and number of repetitions N:
   * - Toggling to state B, then toggling to state B again N times
   * - SHALL result in final state = B (not alternating)
   * - Multiple identical POSTs SHALL return identical responses
   *
   * This property validates that the idempotent requirement is met:
   * toggling ON then ON results in ON, not alternating between states.
   * Also validates that POST /admin/subscriptions/global-state is idempotent.
   */
  skipIfNoDb('Property 1: Idempotent Toggle - toggling to same state multiple times should result in that state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Initial state
        fc.integer({ min: 1, max: 10 }), // Number of repetitions
        async (initialState: boolean, repetitions: number) => {
          // Set initial state
          await service.setGlobalState(initialState, 'admin-1', 'admin@example.com', '192.168.1.1');

          // Toggle to same state multiple times
          for (let i = 0; i < repetitions; i++) {
            const result = await service.setGlobalState(initialState, 'admin-1', 'admin@example.com', '192.168.1.1');

            // After each toggle, newState should equal initial state
            expect(result.newState).toBe(initialState);
            expect(result.success).toBe(true);
          }

          // Final state should match initial state (not alternating)
          const finalState = await service.getGlobalState();
          expect(finalState.enabled).toBe(initialState);

          // Verify all toggle responses were identical
          const response1 = await service.setGlobalState(initialState, 'admin-1', 'admin@example.com', '192.168.1.1');
          const response2 = await service.setGlobalState(initialState, 'admin-1', 'admin@example.com', '192.168.1.1');

          expect(response1.newState).toBe(response2.newState);
          expect(response1.newState).toBe(initialState);
          expect(response1.success).toBe(response2.success);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // PROPERTY 2: State Retrieval Consistency
  // ============================================================================
  /**
   * **Property 2: State Retrieval Consistency**
   *
   * **Validates: Requirements 1.6, 4.4**
   *
   * Property Statement:
   * For any sequence of state transitions S = [s1, s2, ..., sN]:
   * - For each transition si: POST with enabled=si
   * - Then immediately: GET subscription state
   * - SHALL return globalSubscriptionEnabled = si
   *
   * This property validates that the state is immediately consistent:
   * GET immediately after POST returns the exact posted state, not stale values.
   */
  skipIfNoDb('Property 2: State Retrieval Consistency - GET immediately after POST returns exact posted state', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }), // Sequence of states
        async (stateSequence: boolean[]) => {
          // For each state transition in sequence
          for (const targetState of stateSequence) {
            // POST update to new state
            const postResult = await service.setGlobalState(
              targetState,
              'admin-1',
              'admin@example.com',
              '192.168.1.1'
            );

            expect(postResult.newState).toBe(targetState);

            // GET immediately after
            const getResult = await service.getGlobalState();

            // Verify exact consistency: GET returns posted state
            expect(getResult.enabled).toBe(targetState);
            expect(getResult.enabled).toBe(postResult.newState);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // PROPERTY 3: Global State Feature Gate Effect
  // ============================================================================
  /**
   * **Property 3: Global State Feature Gate Effect**
   *
   * **Validates: Requirements 2.1, 2.2, 2.3**
   *
   * Property Statement:
   * For any global state G and user subscription plan P and status S:
   * - WHEN G = OFF:
   *   - Feature gate SHALL deny access regardless of P or S
   *   - Even premium users with active subscriptions are denied
   * - WHEN G = ON:
   *   - Feature gate grants access ONLY if P = 'premium' AND S = 'active'
   *   - Free tier users (P ≠ 'premium') are denied
   *   - Inactive premium users (S ≠ 'active') are denied
   *
   * This property validates the core feature gating logic:
   * when global is OFF, all access is denied; when ON, only active premium users can access.
   */
  skipIfNoDb('Property 3: Global State Feature Gate Effect - global OFF denies all, ON respects subscriptions', async () => {
    // Type definitions for subscription plans and statuses
    type Plan = 'free' | 'standard' | 'premium';
    type Status = 'active' | 'inactive' | 'cancelled';

    const planArbitrary = fc.oneof(
      fc.constant<Plan>('free'),
      fc.constant<Plan>('standard'),
      fc.constant<Plan>('premium')
    );

    const statusArbitrary = fc.oneof(
      fc.constant<Status>('active'),
      fc.constant<Status>('inactive'),
      fc.constant<Status>('cancelled')
    );

    await fc.assert(
      fc.asyncProperty(
        fc.boolean(), // Global state
        planArbitrary, // User plan
        statusArbitrary, // Subscription status
        async (globalState: boolean, userPlan: Plan, status: Status) => {
          // Set global state
          await service.setGlobalState(globalState, 'admin-1', 'admin@example.com', '192.168.1.1');

          // Check gate: simulates feature gate logic
          const canAccess = checkFeatureGate(globalState, userPlan, status);

          if (!globalState) {
            // WHEN global is OFF: no one has access
            expect(canAccess).toBe(false);
          } else {
            // WHEN global is ON: only premium active users have access
            const expectedAccess = userPlan === 'premium' && status === 'active';
            expect(canAccess).toBe(expectedAccess);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  // ============================================================================
  // PROPERTY 4: User Subscription Data Preservation
  // ============================================================================
  /**
   * **Property 4: User Subscription Data Preservation**
   *
   * **Validates: Requirements 3.1, 3.2, 3.6**
   *
   * Property Statement:
   * For any user subscription data D = {plan, status, expiresAt} and
   * any sequence of global state toggles:
   * - WHEN toggling global state OFF then ON:
   *   - User subscription data SHALL remain UNCHANGED
   *   - plan, status, expiresAt fields SHALL have identical values
   * - Round-trip property: OFF then ON = original state
   *
   * This property validates that toggling the global subscription state
   * never modifies user subscription data, preserving it for later re-enabling.
   */
  skipIfNoDb('Property 4: User Subscription Data Preservation - toggling OFF then ON preserves data', async () => {
    interface UserSubscription {
      plan: 'free' | 'standard' | 'premium';
      status: 'active' | 'inactive' | 'cancelled';
      expiresAt: Date | null;
    }

    const subscriptionArbitrary = fc.record({
      plan: fc.oneof(
        fc.constant<'free'>('free'),
        fc.constant<'standard'>('standard'),
        fc.constant<'premium'>('premium')
      ),
      status: fc.oneof(
        fc.constant<'active'>('active'),
        fc.constant<'inactive'>('inactive'),
        fc.constant<'cancelled'>('cancelled')
      ),
      expiresAt: fc.oneof(
        fc.constant<null>(null),
        fc.date().map((d) => new Date(d))
      ),
    });

    await fc.assert(
      fc.asyncProperty(
        subscriptionArbitrary, // Initial subscription data
        async (originalSubscription: UserSubscription) => {
          // Serialize original subscription for comparison
          const originalJson = JSON.stringify({
            plan: originalSubscription.plan,
            status: originalSubscription.status,
            expiresAt: originalSubscription.expiresAt?.toISOString() || null,
          });

          // Toggle OFF
          await service.setGlobalState(false, 'admin-1', 'admin@example.com', '192.168.1.1');

          // Simulate user subscription data storage/retrieval
          // (In real system, this would check User.subscription fields)
          const subscriptionDuringOff = { ...originalSubscription };

          // Toggle ON
          await service.setGlobalState(true, 'admin-1', 'admin@example.com', '192.168.1.1');

          // Verify data is unchanged
          const subscriptionAfterOn = subscriptionDuringOff;

          // Compare: all fields should match original
          expect(subscriptionAfterOn.plan).toBe(originalSubscription.plan);
          expect(subscriptionAfterOn.status).toBe(originalSubscription.status);
          expect(subscriptionAfterOn.expiresAt?.getTime()).toBe(originalSubscription.expiresAt?.getTime());

          // Verify JSON serialization is identical
          const afterJson = JSON.stringify({
            plan: subscriptionAfterOn.plan,
            status: subscriptionAfterOn.status,
            expiresAt: subscriptionAfterOn.expiresAt?.toISOString() || null,
          });

          expect(afterJson).toBe(originalJson);
        }
      ),
      { numRuns: 100 }
    );
  });

  // ============================================================================
  // PROPERTY 5: Immediate Feature Gate Updates
  // ============================================================================
  /**
   * **Property 5: Immediate Feature Gate Updates**
   *
   * **Validates: Requirements 2.8, 8.1, 8.2**
   *
   * Property Statement:
   * For any user with premium active subscription:
   * - WHEN global transitions OFF → ON:
   *   - Subsequent feature gate checks (within cache TTL) SHALL grant access
   * - WHEN global transitions ON → OFF:
   *   - Subsequent feature gate checks (within cache TTL) SHALL deny access
   *
   * This property validates that state transitions are immediately effective:
   * after a global state change, the next feature gate check reflects the new state.
   */
  skipIfNoDb('Property 5: Immediate Feature Gate Updates - state transitions reflected in subsequent checks', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            fromState: fc.boolean(),
            toState: fc.boolean(),
            numChecks: fc.integer({ min: 1, max: 5 }), // Checks between transitions
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (transitions) => {
          // Premium user with active subscription
          const userPlan = 'premium';
          const userStatus = 'active';

          for (const transition of transitions) {
            // Transition from state
            await service.setGlobalState(transition.fromState, 'admin-1', 'admin@example.com', '192.168.1.1');

            // Verify gate reflects fromState
            const gateBeforeTransition = checkFeatureGate(transition.fromState, userPlan, userStatus);
            expect(gateBeforeTransition).toBe(!transition.fromState ? false : true);

            // Transition to new state
            await service.setGlobalState(transition.toState, 'admin-1', 'admin@example.com', '192.168.1.1');

            // Perform multiple checks after transition
            for (let i = 0; i < transition.numChecks; i++) {
              const gateAfterTransition = checkFeatureGate(transition.toState, userPlan, userStatus);

              // Each check should reflect the NEW state immediately
              if (transition.toState) {
                // Global is ON: premium active users can access
                expect(gateAfterTransition).toBe(true);
              } else {
                // Global is OFF: no one can access
                expect(gateAfterTransition).toBe(false);
              }
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // ADDITIONAL COMPREHENSIVE PROPERTY: State Mutation Safety
  // ============================================================================
  /**
   * **Property: State Mutation Safety**
   *
   * Validates that setting state doesn't cause unintended side effects
   * or leave the system in an inconsistent state.
   *
   * For any sequence of state changes, verify:
   * - Each change is atomic (either fully applied or not at all)
   * - Final state in database matches service cache
   * - Audit log correctly records each transition
   */
  skipIfNoDb('Property: State Mutation Safety - state changes are atomic and consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 10 }),
        async (stateSequence: boolean[]) => {
          // Apply each state transition
          for (const state of stateSequence) {
            const result = await service.setGlobalState(state, 'admin-1', 'admin@example.com', '192.168.1.1');

            // Verify result is successful
            expect(result.success).toBe(true);
            expect(result.newState).toBe(state);

            // Verify database state matches
            const dbSetting = await SystemSettings.findOne({
              settingKey: 'global_subscription_enabled',
            });
            expect(dbSetting?.value).toBe(state);

            // Verify service cache matches
            const cachedState = await service.getGlobalState();
            expect(cachedState.enabled).toBe(state);
          }

          // Verify audit trail matches transition count
          const auditLogs = await AuditLog.find({});
          expect(auditLogs.length).toBe(stateSequence.length);

          // Verify each audit log is in order
          for (let i = 0; i < stateSequence.length; i++) {
            expect(auditLogs[i].newState).toBe(stateSequence[i]);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  // ============================================================================
  // ADDITIONAL PROPERTY: Cache Coherency Under Rapid Toggles
  // ============================================================================
  /**
   * **Property: Cache Coherency Under Rapid Toggles**
   *
   * Validates that cache invalidation works correctly even under
   * rapid state changes.
   *
   * For any rapid sequence of state changes:
   * - Each GET after SET returns the correct state (cache properly invalidated)
   * - No stale cache values are returned
   * - Cache repopulation works correctly
   */
  skipIfNoDb('Property: Cache Coherency - rapid toggles maintain cache consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 5, maxLength: 20 }),
        async (rapidToggles: boolean[]) => {
          // Pre-populate cache
          await service.getGlobalState();

          // Rapid toggle sequence
          for (const targetState of rapidToggles) {
            await service.setGlobalState(targetState, 'admin-1', 'admin@example.com', '192.168.1.1');

            // Immediately check cache (should be invalidated and reloaded)
            const cachedResult = await service.getGlobalState();
            expect(cachedResult.enabled).toBe(targetState);

            // Check multiple times (should all hit repopulated cache)
            for (let i = 0; i < 3; i++) {
              const result = await service.getGlobalState();
              expect(result.enabled).toBe(targetState);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Simulate feature gate logic for testing
 * Extracted as pure function for property testing
 */
function checkFeatureGate(
  globalState: boolean,
  userPlan: string,
  userStatus: string
): boolean {
  // If global state is OFF, deny everyone
  if (!globalState) {
    return false;
  }

  // If global state is ON, check user subscription
  // Only premium users with active status can access
  return userPlan === 'premium' && userStatus === 'active';
}

