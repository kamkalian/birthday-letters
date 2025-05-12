import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica'
  },
  section: {
    marginBottom: 30
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: 'center',
    textDecoration: 'underline'
  },
  greeting: {
    fontSize: 16,
    marginBottom: 10
  },
  body: {
    fontSize: 14,
    marginBottom: 10,
    lineHeight: 1.5
  },
  closing: {
    fontSize: 16,
    marginTop: 30
  },
  date: {
    fontSize: 12,
    marginTop: 40,
    textAlign: 'right'
  }
});

const Brief = ({ name, alter, datum, besonderheiten }) => (
  <View style={styles.section}>
    <Text style={styles.title}>Herzlichen Glückwunsch zum Geburtstag!</Text>
    <Text style={styles.greeting}>Liebe/Lieber {name},</Text>
    <Text style={styles.body}>
      herzlichen Glückwunsch zu Deinem {alter}. Geburtstag! 
      Wir wünschen Dir alles Gute, Gesundheit und viel Glück für das neue Lebensjahr.
    </Text>
    {besonderheiten && <Text style={styles.body}>{besonderheiten}</Text>}
    <Text style={styles.body}>
      Lass Dich feiern und genieße Deinen besonderen Tag!
    </Text>
    <Text style={styles.closing}>Herzliche Grüße,</Text>
    <Text style={styles.closing}>Deine Familie/Freunde</Text>
    <Text style={styles.date}>{datum || new Date().toLocaleDateString('de-DE')}</Text>
  </View>
);

export const Geburtstagsbriefe = ({ briefe }) => (
  <Document>
    {briefe.map((brief, index) => (
      <Page key={index} size="A4" style={styles.page}>
        <Brief {...brief} />
      </Page>
    ))}
  </Document>
);