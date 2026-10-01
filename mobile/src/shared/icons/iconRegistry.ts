import type { LucideIcon } from 'lucide-react-native';
// One module per glyph: Metro does not tree-shake, so importing the package root
// would bundle every Lucide icon. Only the icons listed here reach the app.
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ArrowLeftRight from 'lucide-react-native/icons/arrow-left-right';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Banknote from 'lucide-react-native/icons/banknote';
import Bell from 'lucide-react-native/icons/bell';
import Calendar from 'lucide-react-native/icons/calendar';
import Car from 'lucide-react-native/icons/car';
import ChartColumn from 'lucide-react-native/icons/chart-column';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleX from 'lucide-react-native/icons/circle-x';
import Clapperboard from 'lucide-react-native/icons/clapperboard';
import Coffee from 'lucide-react-native/icons/coffee';
import CreditCard from 'lucide-react-native/icons/credit-card';
import Ellipsis from 'lucide-react-native/icons/ellipsis';
import Funnel from 'lucide-react-native/icons/funnel';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import Landmark from 'lucide-react-native/icons/landmark';
import Menu from 'lucide-react-native/icons/menu';
import Pencil from 'lucide-react-native/icons/pencil';
import Plus from 'lucide-react-native/icons/plus';
import Receipt from 'lucide-react-native/icons/receipt';
import ReceiptText from 'lucide-react-native/icons/receipt-text';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import ShoppingBag from 'lucide-react-native/icons/shopping-bag';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Trash from 'lucide-react-native/icons/trash';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import User from 'lucide-react-native/icons/user';
import Utensils from 'lucide-react-native/icons/utensils';
import Wallet from 'lucide-react-native/icons/wallet';
import X from 'lucide-react-native/icons/x';

/**
 * The app's icon vocabulary: semantic name → glyph. Names describe meaning, not shape,
 * so a glyph can change here without touching any screen. Add new icons only here.
 */
export const iconRegistry = Object.freeze({
  // Navigation ("home" is also the housing category).
  home: House,
  transactions: ReceiptText,
  reports: ChartPie,
  settings: Settings,
  menu: Menu,

  // Actions
  add: Plus,
  close: X,
  back: ArrowLeft,
  forward: ArrowRight,
  search: Search,
  filter: Funnel,
  edit: Pencil,
  delete: Trash,
  check: Check,
  more: Ellipsis,
  chevronRight: ChevronRight,
  chevronDown: ChevronDown,

  // Finance
  wallet: Wallet,
  bank: Landmark,
  creditCard: CreditCard,
  cash: Banknote,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowLeftRight: ArrowLeftRight,
  receipt: Receipt,
  chart: ChartColumn,
  calendar: Calendar,

  // Categories (visual only: there is no categories domain yet)
  shoppingCart: ShoppingCart,
  restaurant: Utensils,
  car: Car,
  health: HeartPulse,
  education: GraduationCap,
  entertainment: Clapperboard,
  coffee: Coffee,
  shoppingBag: ShoppingBag,

  // System
  bell: Bell,
  user: User,
  info: Info,
  warning: TriangleAlert,
  error: CircleX,
  success: CircleCheck,
} satisfies Record<string, LucideIcon>);
