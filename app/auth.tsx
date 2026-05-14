import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { getLaunchRoute, signInWithGoogleProfile } from "@/data/appLaunchService";

export default function AuthScreen() {
  const [email, setEmail] = useState("parent@example.com");
  const [displayName, setDisplayName] = useState("Parent");
  const [message, setMessage] = useState<string>();

  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 py-8">
      <View className="flex-1 justify-center">
        <View className="rounded-[32px] bg-white/95 p-5 shadow-sm">
          <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#caff68]">
            <FontAwesome6 name="google" size={20} color="#07110d" />
          </View>
          <Text className="text-3xl font-bold text-[#07110d]">Sign in</Text>
          <Text className="mt-2 text-sm leading-5 text-zinc-600">
            Google OAuth is the only sign-in path. Trips remain invite-only after setup.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Google email"
            className="mt-5 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            className="mt-2 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />

          <Pressable
            onPress={() => {
              try {
                signInWithGoogleProfile({ email, displayName });
                router.replace(getLaunchRoute());
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to sign in.");
              }
            }}
            className="mt-5 rounded-full bg-[#caff68] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              Continue with Google
            </Text>
          </Pressable>
          {message ? <Text className="mt-3 text-sm text-rose-700">{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}
