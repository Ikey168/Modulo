# Conflict Resolution System Documentation

## Overview

The Modulo application now includes a comprehensive conflict resolution system that handles simultaneous edits to notes by multiple users. The system uses optimistic locking with version numbers to detect conflicts and provides a user-friendly interface for resolving them.

## Architecture

### Backend Components

1. **Note Entity with Optimistic Locking**
   - `@Version` annotation on the `version` field
   - Automatic version incrementing on updates
   - `lastEditor` field to track who made the last change

2. **ConflictResolutionService**
   - Detects version conflicts using optimistic locking
   - Provides conflict analysis and comparison
   - Handles force updates after conflict resolution

3. **ConflictResolutionController**
   - REST endpoints for conflict checking and resolution
   - Integration with WebSocket notifications
   - Returns conflict data with HTTP 409 status

4. **ConflictResolutionDto**
   - Data transfer object with conflict analysis methods
   - Includes current and incoming versions for comparison
   - Provides conflict detection for title, content, and tags

### Frontend Components

1. **ConflictResolutionModal**
   - Professional UI with dark mode support
   - Side-by-side comparison of conflicting versions
   - Smart merge suggestions and manual resolution options
   - Responsive design for mobile and desktop

2. **ConflictResolutionService**
   - API client for conflict resolution endpoints
   - Conflict analysis and merge strategy utilities
   - Integration with the Notes component

3. **Types and Interfaces**
   - TypeScript interfaces for type safety
   - Conflict resolution request/response types

## How It Works

### Conflict Detection

1. When a user attempts to update a note, the system includes the expected version number
2. The backend compares the expected version with the current version in the database
3. If versions don't match, a conflict is detected and ConflictResolutionDto is returned
4. The frontend receives a 409 Conflict response and displays the resolution modal

### Conflict Resolution

1. **Auto-Merge**: Smart algorithms suggest automatic resolution
   - Prefers longer titles
   - Combines unique tags from both versions
   - Provides suggestions for content merge

2. **Manual Resolution**: User chooses how to resolve each conflict
   - Keep current version
   - Use incoming version  
   - Custom manual merge

3. **Force Update**: After resolution, the system bypasses version checking
   - Updates the note with resolved content
   - Broadcasts the update via WebSocket

## API Endpoints

### Conflict Detection
```
POST /api/conflicts/check
```
Checks for conflicts before updating a note.

### Update with Conflict Check
```
PUT /api/conflicts/update
```
Attempts to update a note with conflict detection.

### Resolve Conflict
```
PUT /api/conflicts/resolve
```
Force update after manual conflict resolution.

## Usage Example

1. **User A** opens a note and starts editing
2. **User B** opens the same note and makes changes
3. **User B** saves first - update succeeds
4. **User A** tries to save - conflict detected
5. **User A** sees the ConflictResolutionModal with:
   - Current version (User B's changes)
   - Their version (User A's changes) 
   - Smart merge suggestions
6. **User A** chooses resolution strategy and saves
7. **WebSocket** notifies all users of the final update

## Features

- ✅ Optimistic locking with JPA @Version
- ✅ Visual conflict resolution with side-by-side comparison
- ✅ Smart merge suggestions
- ✅ Manual conflict resolution
- ✅ Real-time WebSocket notifications
- ✅ Professional UI with dark mode support
- ✅ Mobile-responsive design
- ✅ Backward compatibility with existing API
- ✅ Comprehensive test coverage

## Testing

The system includes comprehensive unit tests covering:
- Conflict detection scenarios
- Version mismatch handling
- Successful updates
- Force updates after resolution
- Error handling

Run tests with:
```bash
cd backend && mvn test -Dtest=ConflictResolutionServiceTest
```

## Future Enhancements

- Real-time collaborative editing with operational transforms
- More sophisticated content merge algorithms
- Conflict history and audit trail
- User preferences for default resolution strategies