import type { LucideIcon } from 'lucide-react';
import { ContactRound, HeartPulse, Home, MapPinned, NotebookPen, PackageSearch, Palmtree, PiggyBank, ShoppingBag, Sparkles } from 'lucide-react';

export type LifeFieldType = 'text' | 'date' | 'time' | 'url' | 'number' | 'select' | 'textarea' | 'media' | 'education' | 'life';
export type LifeCalendarSource = 'Home' | 'Follow-up' | 'Finance' | 'Travel' | 'Health' | 'Hobby' | 'Purchase' | 'Place' | 'Reflection' | 'Inventory' | 'Security' | 'Wealth' | 'Evidence' | 'Career' | 'Writing' | 'Mobility';
export interface LifeField { key: string; label: string; type: LifeFieldType; placeholder?: string; options?: string[]; sourcePluginId?: string; }
export interface LifePluginConfig {
  id: string;
  title: string;
  singular: string;
  description: string;
  icon: LucideIcon;
  statuses: string[];
  categories: string[];
  fields: LifeField[];
  schedule?: boolean;
  dateLabel?: string;
  endDateLabel?: string;
  amountLabel?: string;
  ratingLabel?: string;
  checklistLabel?: string;
  logLabel?: string;
  completedStatuses: string[];
  calendarSource: LifeCalendarSource;
  /** Enforces the security-domain rule that records contain metadata, never secrets. */
  securityMetadataOnly?: boolean;
}

export const HOME_MAINTENANCE_CONFIG: LifePluginConfig = {
  id: 'home-maintenance', title: 'Home & Maintenance', singular: 'home item', description: 'Chores, appliances, repairs, warranties, manuals, and service history.', icon: Home,
  statuses: ['Due', 'Scheduled', 'Done', 'Paused'], categories: ['Chore', 'Maintenance', 'Repair', 'Appliance'], schedule: true, dateLabel: 'Next due', endDateLabel: 'Stop after', checklistLabel: 'Steps', logLabel: 'Service history', completedStatuses: ['Done'], calendarSource: 'Home',
  fields: [{ key: 'room', label: 'Room', type: 'text' }, { key: 'asset', label: 'Appliance or asset', type: 'text' }, { key: 'provider', label: 'Service provider', type: 'text' }, { key: 'warrantyUntil', label: 'Warranty until', type: 'date' }, { key: 'manualUrl', label: 'Manual URL', type: 'url' }],
};
export const PERSONAL_CRM_CONFIG: LifePluginConfig = {
  id: 'personal-crm', title: 'Personal CRM', singular: 'person', description: 'Relationships, birthdays, follow-ups, interactions, and gift ideas.', icon: ContactRound,
  statuses: ['Active', 'Follow up', 'Waiting', 'Dormant'], categories: ['Family', 'Friend', 'Professional', 'Community', 'Other'], schedule: true, dateLabel: 'Next follow-up', checklistLabel: 'Gift ideas', logLabel: 'Interactions', completedStatuses: [], calendarSource: 'Follow-up',
  fields: [{ key: 'relationship', label: 'Relationship', type: 'text' }, { key: 'birthday', label: 'Birthday', type: 'date' }, { key: 'email', label: 'Email', type: 'text' }, { key: 'phone', label: 'Phone', type: 'text' }, { key: 'lastContact', label: 'Last contact', type: 'date' }],
};
export const FINANCE_CONFIG: LifePluginConfig = {
  id: 'finance-subscriptions', title: 'Finance & Subscriptions', singular: 'financial item', description: 'Budgets, recurring bills, renewals, subscriptions, and savings goals.', icon: PiggyBank,
  statuses: ['Active', 'Due', 'Paid', 'Paused', 'Cancelled'], categories: ['Bill', 'Subscription', 'Budget', 'Savings goal'], schedule: true, dateLabel: 'Next due', endDateLabel: 'Ends', amountLabel: 'Amount', checklistLabel: 'Allocation checklist', logLabel: 'Payments & changes', completedStatuses: ['Paid', 'Cancelled'], calendarSource: 'Finance',
  fields: [{ key: 'currency', label: 'Currency', type: 'text', placeholder: 'EUR' }, { key: 'account', label: 'Account', type: 'text' }, { key: 'provider', label: 'Provider', type: 'text' }, { key: 'renewalTerms', label: 'Renewal or cancellation terms', type: 'textarea' }],
};
export const TRAVEL_CONFIG: LifePluginConfig = {
  id: 'travel-planner', title: 'Travel Planner', singular: 'trip item', description: 'Trips, bookings, itineraries, reservations, packing, and documents.', icon: Palmtree,
  statuses: ['Planning', 'Booked', 'Active', 'Completed', 'Cancelled'], categories: ['Trip', 'Flight', 'Stay', 'Activity', 'Document'], schedule: true, dateLabel: 'Starts', endDateLabel: 'Ends', checklistLabel: 'Packing & preparation', logLabel: 'Itinerary', completedStatuses: ['Completed', 'Cancelled'], calendarSource: 'Travel',
  fields: [{ key: 'destination', label: 'Destination', type: 'text' }, { key: 'bookingReference', label: 'Booking reference', type: 'text' }, { key: 'provider', label: 'Provider', type: 'text' }, { key: 'address', label: 'Address', type: 'text' }, { key: 'documentUrl', label: 'Booking or document URL', type: 'url' }],
};
export const HEALTH_CONFIG: LifePluginConfig = {
  id: 'health-tracker', title: 'Health Tracker', singular: 'health item', description: 'Appointments, medication, symptoms, measurements, and private notes.', icon: HeartPulse,
  statuses: ['Active', 'Scheduled', 'Monitoring', 'Completed', 'Paused'], categories: ['Appointment', 'Medication', 'Symptom', 'Measurement'], schedule: true, dateLabel: 'Next occurrence', endDateLabel: 'Ends', checklistLabel: 'Care checklist', logLabel: 'Health log', completedStatuses: ['Completed'], calendarSource: 'Health',
  fields: [{ key: 'provider', label: 'Provider', type: 'text' }, { key: 'dosage', label: 'Dosage', type: 'text' }, { key: 'schedule', label: 'Instructions', type: 'text' }, { key: 'measurementUnit', label: 'Measurement unit', type: 'text' }],
};
export const HOBBY_CONFIG: LifePluginConfig = {
  id: 'hobby-studio', title: 'Hobby Studio', singular: 'hobby item', description: 'Projects, practice sessions, skills, materials, equipment, and ideas.', icon: Sparkles,
  statuses: ['Idea', 'Active', 'Paused', 'Completed'], categories: ['Project', 'Practice', 'Skill', 'Equipment'], schedule: true, dateLabel: 'Next session', endDateLabel: 'Ends', checklistLabel: 'Milestones', logLabel: 'Practice log', completedStatuses: ['Completed'], calendarSource: 'Hobby',
  fields: [{ key: 'hobby', label: 'Hobby', type: 'text' }, { key: 'skillLevel', label: 'Skill level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] }, { key: 'materials', label: 'Materials', type: 'textarea' }, { key: 'equipment', label: 'Equipment', type: 'textarea' }],
};
export const WISHLIST_CONFIG: LifePluginConfig = {
  id: 'wishlist-purchases', title: 'Wishlist & Purchases', singular: 'purchase', description: 'Wishlists, comparisons, orders, returns, prices, and warranties.', icon: ShoppingBag,
  statuses: ['Saved', 'Comparing', 'Ordered', 'Received', 'Returned'], categories: ['Want', 'Need', 'Gift', 'Upgrade'], amountLabel: 'Target or paid price', checklistLabel: 'Comparison checklist', logLabel: 'Order history', completedStatuses: ['Received', 'Returned'], calendarSource: 'Purchase',
  fields: [{ key: 'vendor', label: 'Vendor', type: 'text' }, { key: 'productUrl', label: 'Product URL', type: 'url' }, { key: 'orderNumber', label: 'Order number', type: 'text' }, { key: 'returnBy', label: 'Return by', type: 'date' }, { key: 'warrantyUntil', label: 'Warranty until', type: 'date' }],
};
export const PLACES_CONFIG: LifePluginConfig = {
  id: 'places-library', title: 'Places Library', singular: 'place', description: 'Restaurants, cafés, museums, trails, shops, visits, and ratings.', icon: MapPinned,
  statuses: ['Want to visit', 'Planned', 'Visited', 'Favorite'], categories: ['Restaurant', 'Café', 'Museum', 'Trail', 'Event', 'Shop', 'Other'], schedule: true, dateLabel: 'Next visit', ratingLabel: 'Rating', checklistLabel: 'Things to try', logLabel: 'Visits', completedStatuses: ['Visited'], calendarSource: 'Place',
  fields: [{ key: 'location', label: 'Location', type: 'text' }, { key: 'mapsUrl', label: 'Map or website URL', type: 'url' }, { key: 'cuisine', label: 'Cuisine or kind', type: 'text' }, { key: 'openingNotes', label: 'Opening notes', type: 'textarea' }],
};
export const JOURNAL_CONFIG: LifePluginConfig = {
  id: 'journal-reflection', title: 'Journal & Reflection', singular: 'entry', description: 'Mood, energy, highlights, gratitude, prompts, and weekly patterns.', icon: NotebookPen,
  statuses: ['Draft', 'Complete'], categories: ['Daily', 'Weekly', 'Monthly', 'Event', 'Reflection'], schedule: true, dateLabel: 'Entry date', ratingLabel: 'Mood', checklistLabel: 'Prompts', logLabel: 'Highlights', completedStatuses: ['Complete'], calendarSource: 'Reflection',
  fields: [{ key: 'energy', label: 'Energy', type: 'select', options: ['Very low', 'Low', 'Steady', 'High', 'Very high'] }, { key: 'gratitude', label: 'Gratitude', type: 'textarea' }, { key: 'lesson', label: 'Lesson or insight', type: 'textarea' }],
};
export const HOME_INVENTORY_CONFIG: LifePluginConfig = {
  id: 'home-inventory', title: 'Home Inventory', singular: 'item', description: 'Possessions, storage, serial numbers, receipts, lending, and insurance values.', icon: PackageSearch,
  statuses: ['Owned', 'Loaned', 'Repair', 'Disposed'], categories: ['Electronics', 'Furniture', 'Kitchen', 'Clothing', 'Tools', 'Documents', 'Other'], amountLabel: 'Purchase or insured value', checklistLabel: 'Parts & accessories', logLabel: 'Ownership history', completedStatuses: ['Disposed'], calendarSource: 'Inventory',
  fields: [{ key: 'location', label: 'Storage location', type: 'text' }, { key: 'serialNumber', label: 'Serial number', type: 'text' }, { key: 'purchasedOn', label: 'Purchased on', type: 'date' }, { key: 'warrantyUntil', label: 'Warranty until', type: 'date' }, { key: 'receiptUrl', label: 'Receipt URL', type: 'url' }, { key: 'borrower', label: 'Borrower', type: 'text' }],
};

export const LIFE_PLUGIN_CONFIGS = [HOME_MAINTENANCE_CONFIG, PERSONAL_CRM_CONFIG, FINANCE_CONFIG, TRAVEL_CONFIG, HEALTH_CONFIG, HOBBY_CONFIG, WISHLIST_CONFIG, PLACES_CONFIG, JOURNAL_CONFIG, HOME_INVENTORY_CONFIG] as const;
