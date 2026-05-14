import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { createReusableFamilyGroup, getLaunchRoute } from "@/data/appLaunchService";
import { getAuthenticatedUser } from "@/data/tripIdentityStore";

export default function FamilySetupScreen() {
  const user = getAuthenticatedUser();
  const [name, setName] = useState("Primary Family");
  const [membersText, setMembersText] = useState("Soham <soham@example.com>\nAva <ava@example.com>");
  const [message, setMessage] = useState<string>();

  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 py-8">
      <View className="flex-1 justify-center">
        <View className="rounded-[32px] bg-white/95 p-5 shadow-sm">
          <Text className="text-3xl font-bold text-[#07110d]">Family group</Text>
          <Text className="mt-2 text-sm leading-5 text-zinc-600">
            Reusable groups create fresh invite snapshots for each trip.
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Group name"
            className="mt-5 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={membersText}
            onChangeText={setMembersText}
            placeholder="Name <email>, one per line"
            multiline
            className="mt-2 min-h-28 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <Pressable
            onPress={() => {
              if (!user) {
                router.replace("/auth");
                return;
              }

              try {
                createReusableFamilyGroup({
                  name,
                  ownerUserId: user.id,
                  membersText
                });
                router.replace(getLaunchRoute());
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to save family group.");
              }
            }}
            className="mt-5 rounded-full bg-[#caff68] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">Save family group</Text>
          </Pressable>
          {message ? <Text className="mt-3 text-sm text-rose-700">{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}
