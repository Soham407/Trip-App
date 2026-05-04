import { StyleSheet, Text, View } from "react-native";

import { getCurrentTrip, getLedgerEntries } from "@/data/currentTripStore";

export default function LedgerScreen() {
  const trip = getCurrentTrip();
  const entries = getLedgerEntries();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Ledger</Text>
      <View style={styles.stack}>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardTitle}>{entry.label}</Text>
            <Text style={styles.cardBody}>
              {trip.currency} {entry.amount.toFixed(2)}
            </Text>
            <Text style={styles.cardMeta}>Paid by {entry.paidBy}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f4",
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1c1917"
  },
  stack: {
    marginTop: 20,
    gap: 12
  },
  card: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#ffffff"
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1917"
  },
  cardBody: {
    marginTop: 4,
    color: "#57534e"
  },
  cardMeta: {
    marginTop: 2,
    color: "#78716c"
  }
});
