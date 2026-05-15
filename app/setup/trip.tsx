import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { createInitialTrip } from "@/data/appLaunchService";
import { hydrateStoresFromSupabase } from "@/data/cloudBootstrap";
import { getAuthenticatedUser, getFamilyGroups } from "@/data/tripIdentityStore";
import { TripChip } from "@/components/trip-ui";

export default function TripSetupScreen() {
  const [hydrated, setHydrated] = useState(false);
  const [destination, setDestination] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [selectedFamilyGroupId, setSelectedFamilyGroupId] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    void hydrateStoresFromSupabase()
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  const user = getAuthenticatedUser();
  const familyGroups = hydrated ? getFamilyGroups() : [];
  const familyGroup =
    familyGroups.find((group) => group.id === selectedFamilyGroupId) ?? familyGroups[0];

  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 py-8">
      <View className="flex-1 justify-center">
        <View className="rounded-[32px] bg-white/95 p-5 shadow-sm">
          <Text className="text-3xl font-bold text-[#07110d]">Create trip</Text>
          <Text className="mt-2 text-sm leading-5 text-zinc-600">
            Create a real trip workspace backed by Supabase.
          </Text>
          {familyGroups.length ? (
            <View className="mt-5">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Reusable family group
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {familyGroups.map((group) => (
                  <TripChip
                    key={group.id}
                    label={group.name}
                    selected={(selectedFamilyGroupId ?? familyGroups[0]?.id) === group.id}
                    onPress={() => setSelectedFamilyGroupId(group.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder="Destination"
            className="mt-5 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={startsOn}
            onChangeText={setStartsOn}
            placeholder="YYYY-MM-DD"
            className="mt-2 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={endsOn}
            onChangeText={setEndsOn}
            placeholder="YYYY-MM-DD"
            className="mt-2 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <Pressable
            disabled={!hydrated}
            onPress={async () => {
              if (!user) {
                router.replace("/auth");
                return;
              }

              if (!familyGroup) {
                router.replace("/setup/family");
                return;
              }

              try {
                await createInitialTrip({
                  familyGroupId: familyGroup.id,
                  createdByUserId: user.id,
                  destination,
                  startsOn,
                  endsOn
                });
                router.replace("/(tabs)");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to create trip.");
              }
            }}
            className="mt-5 rounded-full bg-[#caff68] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">Enter trip workspace</Text>
          </Pressable>
          {message ? <Text className="mt-3 text-sm text-rose-700">{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}
