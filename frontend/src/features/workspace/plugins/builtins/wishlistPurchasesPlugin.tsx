import { ShoppingBag } from 'lucide-react';
import { WishlistPurchasesView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('wishlist-purchases', 'Wishlist', ShoppingBag, 110, 'Finance & Wealth', WishlistPurchasesView);
export default plugin;
