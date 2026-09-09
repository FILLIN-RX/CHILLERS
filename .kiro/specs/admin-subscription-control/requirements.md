# Requirements Document

# Admin Subscription Control System - Requirements Document

## Introduction

The Admin Subscription Control System enables administrators to globally toggle the entire subscription system on or off, allowing the platform to switch between paid and free modes. When the global toggle is OFF, all users are treated as free tier and premium features are locked, regardless of their stored subscription status. When toggled ON, subscriptions work normally and users retain their stored subscription data. This feature provides operational flexibility for managing business model transitions and maintenance scenarios.

## Glossary

- **System**: The platform application (backend and frontend combined)
- **Admin**: A user with admin role (`role: 'admin'`) authenticated in the system
- **Global_Subscription_State**: A system-wide boolean flag stored in the database that indicates whether the subscription system is currently enabled or disabled
- **Subscription_Toggle**: The UI control in the admin panel that allows admins to change the Global_Subscription_State
- **Premium_Features**: Features gated behind subscription requirements (e.g., 1080p quality, downloads, continue watching)
- **Feature_Gate**: Code logic that checks subscription status before granting access to premium features
- **User_Subscription_Data**: Stored subscription information for a user including plan type, status, and expiration date
- **Free_Tier**: The default subscription state where all users have access to basic features only
- **Subscription_System**: The collection of APIs, models, and logic that manages user subscriptions and feature access

## Requirements

### Requirement 1: Global Subscription System Toggle

**User Story:** As an admin, I want to toggle the entire subscription system on or off, so that I can switch the platform between paid and free modes without losing user subscription data.

#### Acceptance Criteria

1. WHEN an admin navigates to the admin settings or subscription management panel, THE System SHALL display a toggle control labeled "Enable Subscriptions" or similar
2. THE Subscription_Toggle SHALL show the current state of the Global_Subscription_State (ON or OFF)
3. WHEN an admin clicks the Subscription_Toggle, THE System SHALL update the Global_Subscription_State in the database atomically
4. WHEN the Global_Subscription_State is toggled or any subscription system operation occurs, THE System SHALL respond with success status and the new state within 500ms
5. THE System SHALL persist the Global_Subscription_State in a persistent storage (database) that survives application restarts
6. WHEN an admin retrieves the current subscription system state, THE System SHALL return the current value of Global_Subscription_State
7. THE Subscription_Toggle SHALL be accessible only to users who are both authenticated and authorized as admins (verified via adminMiddleware)

#### Correctness Properties

- **Idempotence**: Toggling the subscription system twice to the same state SHALL result in that state being active (toggling ON then ON results in ON, not alternating)
- **Atomicity**: If the database update fails, the toggle SHALL not update in the UI, and an error SHALL be returned
- **Persistence**: After toggling the Global_Subscription_State and restarting the application, the state SHALL remain as it was set

### Requirement 2: Feature Gating Based on Global State

**User Story:** As the system, I want to check the global subscription toggle before applying feature gates, so that premium features are locked when subscriptions are disabled globally.

#### Acceptance Criteria

1. WHEN the Global_Subscription_State is OFF, THE Feature_Gate SHALL treat all users (including those with premium subscriptions) as free tier
2. WHEN the Global_Subscription_State is OFF, THE Feature_Gate SHALL prevent access to premium features regardless of the User_Subscription_Data
3. WHEN the Global_Subscription_State is ON, THE Feature_Gate SHALL apply normal subscription-based feature gating based on individual User_Subscription_Data, still denying access if the user lacks a premium subscription
4. WHEN a user requests a premium feature and the Global_Subscription_State is OFF, THE System SHALL return a response indicating the feature is unavailable
5. WHEN a user requests a premium feature and the Global_Subscription_State is ON with an active premium subscription, THE System SHALL grant access to the premium feature
6. THE System SHALL check the Global_Subscription_State on every premium feature request (not cached locally)
7. IF the Global_Subscription_State check fails due to network issues or service unavailability, THE System SHALL deny access, treating it as if subscriptions are disabled
7. IF the Global_Subscription_State changes, THE System SHALL apply the new gating rules to subsequent requests without requiring user logout

#### Correctness Properties

- **Metamorphic Property**: When Global_Subscription_State is OFF, all users SHALL have identical feature access to a free tier user (regardless of their stored subscription.plan)
- **State Consistency**: If Global_Subscription_State is OFF and then turned ON, users SHALL immediately regain access to features matching their User_Subscription_Data without modification
- **Non-Breaking Change**: Changing Global_Subscription_State SHALL not modify or corrupt any User_Subscription_Data

### Requirement 3: Preserve User Subscription Data

**User Story:** As an admin, I want user subscription data preserved when toggling subscriptions off, so that I can re-enable subscriptions and users retain their original subscriptions.

#### Acceptance Criteria

1. WHEN the Global_Subscription_State is toggled to OFF, THE System SHALL not modify any User_Subscription_Data in the database
2. WHEN the Global_Subscription_State is toggled to ON, THE System SHALL not modify any User_Subscription_Data in the database
3. WHEN the Global_Subscription_State is OFF, THE System SHALL not automatically expire, cancel, or downgrade any User_Subscription_Data
4. WHEN a user's subscription was premium before the Global_Subscription_State was turned OFF, THE System SHALL retain the plan, status, and expiresAt fields unchanged
5. IF an admin manually updates a user subscription while Global_Subscription_State is OFF, THE System SHALL allow the update and store it normally
6. WHEN the Global_Subscription_State transitions from OFF to ON, THE System SHALL restore all previously stored User_Subscription_Data without modification

#### Correctness Properties

- **Round-Trip Property**: For any User_Subscription_Data, toggling OFF then ON SHALL result in identical subscription state (OFF then ON = original state)
- **Data Integrity**: User_Subscription_Data fields (plan, status, expiresAt) SHALL remain unchanged during any Global_Subscription_State toggle
- **No Side Effects**: Toggling Global_Subscription_State SHALL not trigger subscription expiration checks or automatic status updates

### Requirement 4: API Endpoint for Global Subscription State

**User Story:** As a backend service, I want a REST API to get and set the global subscription state, so that the admin panel and other services can manage it programmatically.

#### Acceptance Criteria

1. WHEN an admin sends a GET request to `/admin/subscriptions/global-state`, THE System SHALL return the current Global_Subscription_State with HTTP 200
2. THE GET response SHALL include a JSON object with fields: `{ success: boolean, globalSubscriptionEnabled: boolean }`
3. WHEN an admin sends a POST request to `/admin/subscriptions/global-state` with body `{ enabled: boolean }`, THE System SHALL update the Global_Subscription_State atomically
4. THE POST response SHALL return HTTP 200 with JSON `{ success: boolean, globalSubscriptionEnabled: boolean, message: string }`
5. THE POST endpoint SHALL validate that the `enabled` field is a boolean, returning HTTP 400 if not
6. BOTH endpoints SHALL require admin authentication via adminMiddleware
7. IF authentication or authorization fails, THE System SHALL return HTTP 401 with error message
8. WHEN the subscription state is updated, THE System SHALL log the action with admin user ID and timestamp
9. IF the Global_Subscription_State check fails during a feature gate request, THE System SHALL deny access instead of assuming the previous state

#### Correctness Properties

- **Idempotence**: POSTing the same state multiple times SHALL result in the same response (POST /api/subscriptions/global-state with enabled=true twice SHALL succeed both times)
- **Consistency**: GET immediately after POST SHALL return the posted state
- **Atomicity**: POST failure SHALL not partially update the state (either fully updated or not updated)

### Requirement 5: Admin UI for Subscription Toggle

**User Story:** As an admin, I want a simple, clear toggle control in the admin panel, so that I can quickly enable or disable the subscription system.

#### Acceptance Criteria

1. THE Subscription_Toggle SHALL be located in the admin panel at `/admin/subscriptions` or `/admin/settings`
2. THE Subscription_Toggle SHALL display the current state clearly (e.g., "Subscriptions: ON" or "Subscriptions: OFF")
3. THE Subscription_Toggle SHALL include visual feedback during toggle transition (e.g., loading spinner, disabled state)
4. WHEN the admin clicks the toggle, THE System SHALL send the update request immediately without requiring form submission
5. WHEN the toggle update succeeds, THE System SHALL display a success message or notification
6. WHEN the toggle update fails, THE System SHALL display an error message and immediately revert the toggle to reflect the actual server state
7. THE Subscription_Toggle SHALL display the label in the admin's preferred language if available, otherwise in English
8. THE Subscription_Toggle control SHALL be responsive and functional on desktop and tablet devices

#### Correctness Properties

- **State Reflection**: The UI toggle position SHALL always reflect the actual Global_Subscription_State from the server after load
- **No Stale State**: If the toggle fails to update, the UI SHALL revert to the correct server state without user intervention
- **Deterministic Feedback**: Identical admin actions (clicking toggle) SHALL produce identical UI feedback

### Requirement 6: Audit and Logging

**User Story:** As an admin auditor, I want to track when subscription system state changes occur, so that I can maintain compliance and security records.

#### Acceptance Criteria

1. WHEN an admin changes the Global_Subscription_State, THE System SHALL log the action with: admin user ID, admin email, previous state, new state, timestamp
2. THE log entry SHALL be stored in a persistent log or audit collection accessible to admins
3. THE log SHALL include HTTP status code and request IP address for security tracking
4. WHEN an admin requests the toggle history, THE System SHALL retrieve the 100 most recent state changes
5. THE toggle history SHALL display in reverse chronological order (most recent first)

### Requirement 7: Backend Setting Persistence

**User Story:** As the backend system, I want the global subscription state stored persistently, so that the setting survives application restarts and deployments.

#### Acceptance Criteria

1. THE Global_Subscription_State SHALL be stored in the MongoDB database in a document/collection designated for system settings
2. THE Global_Subscription_State field SHALL default to `true` (subscriptions enabled) on first system initialization
3. WHEN the application starts, THE System SHALL load the Global_Subscription_State from the database
4. THE System SHALL cache the Global_Subscription_State in memory for performance (e.g., Redis or in-memory cache)
5. IF the in-memory cache is invalidated, THE System SHALL reload the Global_Subscription_State from the database
6. WHEN the Global_Subscription_State is updated, THE System SHALL invalidate the cache and update the database atomically

#### Correctness Properties

- **Durability**: If the application crashes immediately after updating Global_Subscription_State, on restart the state SHALL be correct
- **Single Source of Truth**: All services accessing Global_Subscription_State SHALL read from the same persistent source
- **Cache Coherency**: The in-memory cache SHALL never return stale data (miss is acceptable, wrong value is not)

### Requirement 8: Subscription State Change Effects on Existing Users

**User Story:** As the system, I want to properly handle users' access when the global subscription state changes, so that feature availability updates correctly in real-time.

#### Acceptance Criteria

1. WHEN the Global_Subscription_State is turned OFF, users with active premium subscriptions SHALL immediately lose access to premium features on their next request
2. WHEN the Global_Subscription_State is turned ON, users with active premium subscriptions SHALL immediately regain access to premium features on their next request
3. THE System SHALL NOT require users to re-login when the Global_Subscription_State changes
4. THE System SHALL NOT invalidate active user sessions when the Global_Subscription_State changes
5. IF a user is currently streaming a premium feature when the Global_Subscription_State is turned OFF, THE System SHALL not interrupt the stream but SHALL deny new premium access requests
6. WHEN the Global_Subscription_State is OFF, users viewing the UI SHALL see premium features as locked/unavailable within 5 seconds of the change

#### Correctness Properties

- **Immediate Consistency**: After Global_Subscription_State update, feature gate checks SHALL reflect the new state
- **No Data Loss**: Toggling state SHALL not delete, modify, or corrupt User_Subscription_Data
- **State Independence**: A user's Feature_Gate access SHALL depend ONLY on Global_Subscription_State AND their User_Subscription_Data (no other factors)

### Requirement 9: Error Handling and Recovery

**User Story:** As the system, I want to handle errors gracefully when managing the subscription state, so that failures don't leave the system in an inconsistent state.

#### Acceptance Criteria

1. IF the database update fails when toggling Global_Subscription_State, THE System SHALL return HTTP 500 with error message and SHALL NOT update the cached state
2. IF the cache invalidation fails, THE System SHALL log the error but still respond successfully to the user
3. WHEN a request to check subscription state encounters a database error, THE System SHALL fall back to a safe default (subscriptions enabled)
4. THE System SHALL not expose internal database errors to the client; instead, SHALL return generic error message
5. WHEN an API request is malformed (invalid JSON, missing fields), THE System SHALL return HTTP 400 with descriptive error message

#### Correctness Properties

- **No Partial Updates**: If any step of the toggle operation fails, the entire operation SHALL be rolled back
- **Fail-Safe Behavior**: On error, the system SHALL maintain subscriptions as enabled (safer default for business)
- **Error Logging**: All errors SHALL be logged with sufficient context to diagnose and fix issues

### Requirement 10: Performance and Scalability

**User Story:** As the system, I want subscription state checks to be fast and scalable, so that feature gating doesn't introduce latency.

#### Acceptance Criteria

1. WHEN checking the Global_Subscription_State for feature gating, THE System SHALL respond within 10ms (using cached state)
2. WHEN updating the Global_Subscription_State via API, THE System SHALL respond within 500ms
3. THE System SHALL cache the Global_Subscription_State to avoid database queries for every feature check
4. THE System SHALL support concurrent feature gate checks without degradation (at least 1000 requests/second)
5. THE System SHALL not require additional database indexes for subscription state retrieval, even if performance targets are not fully achieved without them

#### Correctness Properties

- **Performance Under Load**: Subscription checks SHALL maintain sub-10ms latency even with 100+ concurrent requests
- **No Thundering Herd**: Cache invalidation SHALL not cause all concurrent requests to hit the database simultaneously

