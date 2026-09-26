import { PiggyBank } from 'lucide-react';
import { FinanceSubscriptionsView } from '../../LifePluginViews';
import { createLifePlugin } from './lifePlugin';
const plugin = createLifePlugin('finance-subscriptions', 'Finance', PiggyBank, 70, 'Finance & Wealth', FinanceSubscriptionsView);
export default plugin;
