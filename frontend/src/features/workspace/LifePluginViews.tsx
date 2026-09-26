import { LifeCollectionView } from './LifeCollectionView';
import { FINANCE_CONFIG, HEALTH_CONFIG, HOBBY_CONFIG, HOME_INVENTORY_CONFIG, HOME_MAINTENANCE_CONFIG, JOURNAL_CONFIG, PERSONAL_CRM_CONFIG, PLACES_CONFIG, TRAVEL_CONFIG, WISHLIST_CONFIG } from './lifeConfigs';

export const HomeMaintenanceView = () => <LifeCollectionView config={HOME_MAINTENANCE_CONFIG} />;
export const PersonalCrmView = () => <LifeCollectionView config={PERSONAL_CRM_CONFIG} />;
export const FinanceSubscriptionsView = () => <LifeCollectionView config={FINANCE_CONFIG} />;
export const TravelPlannerView = () => <LifeCollectionView config={TRAVEL_CONFIG} />;
export const HealthTrackerView = () => <LifeCollectionView config={HEALTH_CONFIG} />;
export const HobbyStudioView = () => <LifeCollectionView config={HOBBY_CONFIG} />;
export const WishlistPurchasesView = () => <LifeCollectionView config={WISHLIST_CONFIG} />;
export const PlacesLibraryView = () => <LifeCollectionView config={PLACES_CONFIG} />;
export const JournalReflectionView = () => <LifeCollectionView config={JOURNAL_CONFIG} />;
export const HomeInventoryView = () => <LifeCollectionView config={HOME_INVENTORY_CONFIG} />;
