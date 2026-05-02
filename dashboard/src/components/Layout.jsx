import { NavLink, Outlet } from "react-router-dom";
import {
  Phone, PhoneOutgoing, Users, BarChart3, Bot, LayoutTemplate, Megaphone,
  Settings, DollarSign, ShieldCheck, Gauge, MessageSquare, Plug,
} from "lucide-react";
import { Separator } from "./ui/separator";

const NAV_MAIN = [
  { to: "/dashboard", label: "Call Log", icon: Phone },
  { to: "/dashboard/call", label: "Make a Call", icon: PhoneOutgoing },
  { to: "/dashboard/contacts", label: "Contacts", icon: Users },
  { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/dashboard/agents", label: "Agents", icon: Bot },
  { to: "/dashboard/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
];

const NAV_FEATURES = [
  { to: "/dashboard/revenue", label: "Revenue", icon: DollarSign },
  { to: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
  { to: "/dashboard/latency", label: "Latency", icon: Gauge },
  { to: "/dashboard/whatsapp", label: "WhatsApp", icon: MessageSquare },
  { to: "/dashboard/integrations", label: "Integrations", icon: Plug },
];

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-blue-600/20 text-blue-400"
            : "text-gray-400 hover:bg-gray-800 hover:text-white"
        }`
      }
    >
      <Icon size={16} />
      {label}
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-lg font-bold tracking-tight">Cogniflow Home</h1>
          <p className="text-xs text-gray-500">AI Voice Agent</p>
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {NAV_MAIN.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} end={to === "/dashboard"} />
          ))}

          <Separator className="my-3" />
          <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">Edge Features</p>

          {NAV_FEATURES.map(({ to, label, icon }) => (
            <NavItem key={to} to={to} label={label} icon={icon} />
          ))}

          <Separator className="my-3" />
          <NavItem to="/dashboard/settings" label="Settings" icon={Settings} />
        </nav>
        <div className="p-4 border-t border-gray-800 text-xs text-gray-600">
          v2.0.0
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
