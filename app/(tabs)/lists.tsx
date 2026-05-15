import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import {
  buildVoiceDictationReview,
  commitVoiceDictationReview,
  deleteTripListItem,
  getListSuggestions,
  getTripListsByKind,
  removeVoiceDictationReviewItem,
  subscribeCurrentTripStore,
  toggleTripListItem,
  type TripListKind,
  type VoiceDictationReview
} from "@/data/currentTripStore";
import { TripBottomSheet, TripCard, TripChip, TripScreenShell } from "@/components/trip-ui";

const LIST_TABS: readonly { readonly kind: TripListKind; readonly label: string }[] = [
  { kind: "shopping", label: "Shopping" },
  { kind: "packing", label: "Packing" }
];

export default function ListsScreen() {
  const [storeRevision, setStoreRevision] = useState(0);
  useEffect(() => subscribeCurrentTripStore(() => setStoreRevision((value) => value + 1)), []);

  const [activeTab, setActiveTab] = useState<TripListKind>("shopping");
  const [draftText, setDraftText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [review, setReview] = useState<VoiceDictationReview | undefined>();
  const [dictating, setDictating] = useState(false);
  const recognizerRef = useRef<{
    start: () => void;
    stop: () => void;
    onresult?: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
    onerror?: () => void;
    onend?: () => void;
    continuous?: boolean;
    interimResults?: boolean;
    lang?: string;
  } | null>(null);

  const lists = useMemo(() => getTripListsByKind(activeTab), [activeTab, storeRevision]);
  const suggestions = useMemo(
    () => getListSuggestions(activeTab, draftText).slice(0, 8),
    [activeTab, draftText, storeRevision]
  );

  const openReviewFromDraft = () => {
    const result = buildVoiceDictationReview({
      kind: activeTab,
      utterance: draftText,
      isOnline: true
    });

    if (result.status === "blocked") {
      setStatusMessage(result.message);
      return;
    }

    setStatusMessage("");
    setReview(result.review);
  };

  const appendSuggestion = (label: string) => {
    const cleanText = draftText.trim();

    if (!cleanText.length) {
      setDraftText(label);
      return;
    }

    const hasTrailingSeparator = /[,\n]\s*$/.test(draftText);
    const nextSeparator = hasTrailingSeparator ? " " : ", ";

    setDraftText(`${draftText}${nextSeparator}${label}`);
  };

  useEffect(() => {
    return () => {
      recognizerRef.current?.stop();
    };
  }, []);

  function toggleVoiceDictation() {
    if (dictating) {
      recognizerRef.current?.stop();
      setDictating(false);
      return;
    }

    if (typeof window === "undefined") {
      setStatusMessage("Voice dictation is currently available in the web build.");
      return;
    }

    const SpeechRecognitionCtor =
      (globalThis as typeof globalThis & {
        SpeechRecognition?: new () => typeof recognizerRef.current;
        webkitSpeechRecognition?: new () => typeof recognizerRef.current;
      }).SpeechRecognition ??
      (globalThis as typeof globalThis & {
        SpeechRecognition?: new () => typeof recognizerRef.current;
        webkitSpeechRecognition?: new () => typeof recognizerRef.current;
      }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setStatusMessage("This browser does not support microphone dictation.");
      return;
    }

    const recognizer = new SpeechRecognitionCtor();

    if (!recognizer) {
      setStatusMessage("This browser does not support microphone dictation.");
      return;
    }

    recognizer.continuous = false;
    recognizer.interimResults = false;
    recognizer.lang = "en-IN";
    recognizer.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(", ")
        .trim();

      if (!transcript) {
        return;
      }

      setDraftText((current) => {
        const trimmed = current.trim();
        return trimmed ? `${trimmed}, ${transcript}` : transcript;
      });
      setStatusMessage("Voice dictation added to the draft. Review before saving.");
    };
    recognizer.onerror = () => {
      setStatusMessage("Voice dictation failed. Try again or type the items instead.");
      setDictating(false);
    };
    recognizer.onend = () => {
      setDictating(false);
    };

    recognizerRef.current = recognizer;
    setStatusMessage("Listening for list items...");
    setDictating(true);
    recognizer.start();
  }

  return (
    <TripScreenShell title="Trip Lists" subtitle="Shopping and packing for this trip">
      <ScrollView className="flex-1" contentContainerClassName="gap-4 pb-28">
        <TripCard className="bg-[#f7fbf8]">
          <View className="mb-4 flex-row gap-2 rounded-full bg-[#eef4f1] p-1">
            {LIST_TABS.map((tab) => (
              <TripChip
                key={tab.kind}
                label={tab.label}
                selected={activeTab === tab.kind}
                onPress={() => setActiveTab(tab.kind)}
              />
            ))}
          </View>

          <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Add multiple items (freeform or autocomplete)
          </Text>
          <TextInput
            className="mt-2 min-h-20 rounded-[24px] border border-zinc-100 bg-white px-4 py-3 text-sm text-zinc-900"
            placeholder="Try: milk, eggs and bananas"
            value={draftText}
            onChangeText={setDraftText}
            multiline
          />

          {suggestions.length ? (
            <View className="mt-3 flex-row flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <TripChip
                  key={suggestion}
                  label={suggestion}
                  onPress={() => appendSuggestion(suggestion)}
                />
              ))}
            </View>
          ) : null}

          <View className="mt-3 flex-row items-center gap-2">
            <Pressable
              onPress={openReviewFromDraft}
              className="rounded-full bg-[#caff68] px-5 py-3"
            >
              <Text className="text-sm font-semibold text-[#07110d]">
                Review and add
              </Text>
            </Pressable>
            <Pressable
              onPress={toggleVoiceDictation}
              className={dictating ? "rounded-full bg-[#123f33] px-5 py-3" : "rounded-full bg-white px-5 py-3"}
            >
              <Text className={dictating ? "text-sm font-semibold text-white" : "text-sm font-semibold text-[#07110d]"}>
                {dictating ? "Stop dictation" : "Start dictation"}
              </Text>
            </Pressable>
          </View>

          {statusMessage ? <Text className="mt-2 text-xs text-zinc-500">{statusMessage}</Text> : null}
        </TripCard>

        {lists.map((list) => {
          const checkedCount = list.items.filter((item) => item.checked).length;
          const totalCount = list.items.length;
          const completeLabel = activeTab === "shopping" ? "Acquired" : "Packed";

          return (
            <TripCard key={list.id}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Text className="text-xl font-semibold text-[#07110d]">{list.title}</Text>
                  <Text className="mt-1 text-sm text-zinc-500">
                    {completeLabel} {checkedCount}/{totalCount}
                  </Text>
                </View>
                <View className="h-14 w-14 items-center justify-center rounded-full bg-[#eef4f1]">
                  <Text className="text-base font-bold text-[#07110d]">
                    {totalCount === 0 ? 0 : Math.round((checkedCount / totalCount) * 100)}%
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row flex-wrap gap-2">
                {list.items.map((item) => (
                  <View
                    key={item.id}
                    className="flex-row items-center gap-2 rounded-full bg-[#eef4f1] pr-2"
                  >
                    <TripChip
                      label={item.label}
                      selected={item.checked}
                      onPress={() => {
                        toggleTripListItem({ kind: activeTab, itemId: item.id });
                      }}
                    />
                    <Pressable
                      onPress={() => deleteTripListItem({ kind: activeTab, itemId: item.id })}
                      className="h-8 w-8 items-center justify-center rounded-full bg-white"
                    >
                      <FontAwesome6 name="xmark" size={12} color="#7f1d1d" />
                    </Pressable>
                  </View>
                ))}
              </View>
            </TripCard>
          );
        })}
      </ScrollView>

      <TripBottomSheet
        visible={!!review}
        title={`Review ${activeTab} items`}
        onClose={() => setReview(undefined)}
      >
        <Text className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
          Remove anything incorrect before save
        </Text>
        <View className="mb-4 gap-2">
          {review?.candidates.map((candidate) => (
            <View key={candidate.id} className="flex-row items-center justify-between rounded-2xl border border-zinc-200 px-3 py-2">
              <Text className="text-sm text-zinc-900">{candidate.label}</Text>
              <Pressable
                onPress={() => {
                  if (!review) {
                    return;
                  }

                  setReview(
                    removeVoiceDictationReviewItem({
                      review,
                      candidateId: candidate.id
                    })
                  );
                }}
                className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1"
              >
                <Text className="text-xs font-semibold uppercase tracking-wide text-zinc-700">Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            if (!review) {
              return;
            }

            commitVoiceDictationReview(review);
            setReview(undefined);
            setDraftText("");
          }}
          className="self-start rounded-full border border-teal-700 bg-teal-600 px-4 py-2"
        >
          <Text className="text-xs font-semibold uppercase tracking-wide text-white">Save all</Text>
        </Pressable>
      </TripBottomSheet>
    </TripScreenShell>
  );
}
