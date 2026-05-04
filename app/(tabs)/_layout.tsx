import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

import { TAB_ROUTES } from "@/navigation/tabs";

function TabBarIcon(props: {
  name: ComponentProps<typeof FontAwesome6>["name"];
  color: string;
}) {
  return <FontAwesome6 size={18} {...props} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0f766e",
        tabBarInactiveTintColor: "#6b7280",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopColor: "#f1f5f9",
          borderTopWidth: 1,
          height: 66,
          paddingBottom: 10,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: TAB_ROUTES[0].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[0].icon} color={color} />
        }}
      />
      <Tabs.Screen
        name="lists"
        options={{
          title: TAB_ROUTES[1].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[1].icon} color={color} />
        }}
      />
      <Tabs.Screen
        name="ledger"
        options={{
          title: TAB_ROUTES[2].name,
          tabBarIcon: ({ color }) => <TabBarIcon name={TAB_ROUTES[2].icon} color={color} />
        }}
      />
    </Tabs>
  );
}
