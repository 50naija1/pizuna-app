// screens/ContactsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Button, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Contacts from 'expo-contacts';
import { api, loadToken } from '../lib/api';

export default function ContactsScreen({ navigation, route }) {
  const [contacts, setContacts] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'App needs access to contacts for friend matching.');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      if (data.length > 0) {
        // flatten and normalize numbers
        const phones = [];
        data.forEach(c => {
          (c.phoneNumbers || []).forEach(p => {
            const num = p.number.replace(/[^0-9+]/g, '');
            if (num) phones.push(num);
          });
        });
        setContacts(data);
        // call backend to sync
        try {
          setLoading(true);
          // ensure token is loaded into api headers
          await loadToken();
          const res = await api.post('/api/contacts/sync', { phones });
          setMatches(res.data.matches || []);
        } catch (err) {
          console.warn('contacts sync error', err.message || err);
        } finally {
          setLoading(false);
        }
      }
    })();
  }, []);

  const startChat = (otherUser) => {
    // For demo: we create or use conversation id = sorted user ids string
    navigation.navigate('Chat', { otherUser });
  };

  return (
    <View style={{ flex:1, padding:12 }}>
      <Text style={{ marginBottom:8 }}>Matched users in your contacts:</Text>
      <FlatList
        data={matches}
        keyExtractor={(i) => i._id || i.phone}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => startChat(item)}>
            <Text style={{ fontWeight:'600' }}>{item.name || item.phone}</Text>
            <Text style={{ color:'#666' }}>{item.phone}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text>{loading ? 'Syncing contacts...' : 'No matches found (or grant contacts permission)'}</Text>}
      />
      <View style={{ marginTop:12 }}>
        <Button title="Manual start chat (enter phone)" onPress={() => {
          navigation.navigate('Chat', { otherUser: { phone: '+000', name: 'Manual user' }});
        }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: { padding:12, borderBottomWidth:1, borderColor:'#eee' }
});
