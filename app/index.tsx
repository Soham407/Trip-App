import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { getLaunchRouteAsync } from "@/data/appLaunchService";

export default function Index() {
  const [message, setMessage] = useState("Connecting to Supabase...");

  useEffect(() => {
    let cancelled = false;

    async function launch() {
      try {
        const route = await getLaunchRouteAsync();

        if (!cancelled) {
          router.replace(route);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to connect to Supabase.");
        }
      }
    }

    void launch();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-[#eef4f1] px-5">
      <Text className="text-center text-sm font-semibold text-[#07110d]">{message}</Text>
    </View>
  );
}
