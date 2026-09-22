import { useSyncExternalStore } from 'react';
import {
  hasWorkspaceStorageFailure,
  subscribeWorkspaceStorage,
} from './workspaceStorage';
import { SystemBanner } from './mobile/SystemBanner';

export function WorkspaceStorageNotice() {
  const failed = useSyncExternalStore(
    subscribeWorkspaceStorage,
    hasWorkspaceStorageFailure,
    () => false,
  );
  if (!failed) return null;
  // Docked to the bottom edge this sat under the phone's navigation bar and
  // behind the action button. It belongs with the other session banners, under
  // the app bar, where nothing is drawn on top of it.
  return (
    <SystemBanner tone="alert">
      Couldn’t save changes on this device. Free some storage, then save again.
      Your last saved data is unchanged.
    </SystemBanner>
  );
}
