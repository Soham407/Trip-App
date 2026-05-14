import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as Linking from "expo-linking";

import {
  getLaunchRouteAsync,
  signInWithEmailLink,
  signInWithGoogleOAuth
} from "@/data/appLaunchService";
import { supabase } from "@/data/supabaseClient";

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const navigating = useRef(false);

  async function finishExistingSession() {
    if (navigating.current) return;
    navigating.current = true;
    setSubmitting(true);
    setMessage(undefined);

    try {
      router.replace(await getLaunchRouteAsync());
    } catch (error) {
      navigating.current = false;
      setMessage(error instanceof Error ? error.message : "Unable to load your trip workspace.");
    } finally {
      setSubmitting(false);
    }
  }

  // Automatically navigate when Supabase establishes a session.
  // On web: fires after detectSessionInUrl parses the OAuth callback URL hash.
  // On native: fires after exchangeCodeForSession (below) succeeds.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        void finishExistingSession();
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On native (Expo Go / production build), Supabase uses the PKCE flow.
  // After OAuth the app receives a deep link with ?code=... — exchange it for a session.
  // Web handles this automatically via detectSessionInUrl, so skip it there.
  const url = Linking.useURL();
  useEffect(() => {
    if (typeof document !== "undefined") return; // web — handled automatically
    if (!url || !url.includes("code=")) return;
    void supabase.auth.exchangeCodeForSession(url).catch(() => {});
  }, [url]);

  return (
    <View className="w-full max-w-[430px] flex-1 self-center bg-[#eef4f1] px-5 py-8">
      <View className="flex-1 justify-center">
        <View className="rounded-[32px] bg-white/95 p-5 shadow-sm">
          <View className="mb-5 h-14 w-14 items-center justify-center rounded-full bg-[#caff68]">
            <FontAwesome6 name="google" size={20} color="#07110d" />
          </View>
          <Text className="text-3xl font-bold text-[#07110d]">Sign in</Text>
          <Text className="mt-2 text-sm leading-5 text-zinc-600">
            Use the Google account that is invited to the trip. The dashboard opens only after Supabase confirms the session.
          </Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Google email"
            className="mt-5 rounded-2xl border border-zinc-100 bg-[#f7fbf8] px-4 py-3 text-sm text-zinc-900"
          />

          <Pressable
            disabled={submitting}
            onPress={async () => {
              setSubmitting(true);
              setMessage(undefined);

              try {
                await signInWithGoogleOAuth();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to sign in.");
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-5 rounded-full bg-[#caff68] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              Continue with Google OAuth
            </Text>
          </Pressable>
          <Pressable
            disabled={submitting}
            onPress={async () => {
              setSubmitting(true);
              setMessage(undefined);

              try {
                await signInWithEmailLink(email);
                setMessage("Check your email for the Supabase sign-in link, then return here.");
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Unable to send sign-in link.");
              } finally {
                setSubmitting(false);
              }
            }}
            className="mt-3 rounded-full border border-zinc-200 bg-white px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              Send email sign-in link
            </Text>
          </Pressable>
          <Pressable
            disabled={submitting}
            onPress={finishExistingSession}
            className="mt-3 rounded-full bg-[#eef4f1] px-5 py-4"
          >
            <Text className="text-center text-sm font-semibold text-[#07110d]">
              I already signed in
            </Text>
          </Pressable>
          {message ? <Text className="mt-3 text-sm text-rose-700">{message}</Text> : null}
        </View>
      </View>
    </View>
  );
}
