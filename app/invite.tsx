import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { acceptTripInviteFromToken } from "@/data/appLaunchService";

export default function InviteScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);

  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 py-8">
      <View className="flex-1 justify-center">
        <View className="rounded-[32px] bg-white/95 p-5 shadow-sm">
          <Text className="text-3xl font-bold text-[#07110d]">Trip invite</Text>
          <Text className="mt-2 text-sm leading-5 text-zinc-600">
            Accept the trip with the Google account that received the invite.
          </Text>

          <Pressable
            disabled={submitting || !token}
            onPress={async () => {
              if (!token) {
                setMessage("Invite link is missing a token.");
                return;
              }

              setSubmitting(true);
              setMessage(undefined);

              try {
                await acceptTripInviteFromToken(token);
                router.replace("/(tabs)");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to accept the invite.");
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-5 rounded-full bg-[#caff68] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">Accept invite</Text>
          </Pressable>

          <Pressable
            disabled={submitting}
            onPress={() => router.replace("/auth")}
            className="mt-3 rounded-full bg-[#eef4f1] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">Sign in with Google</Text>
          </Pressable>

          {message ? <Text className="mt-3 text-sm text-rose-700">{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}
