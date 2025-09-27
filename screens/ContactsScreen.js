// screens/ContactsScreen.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  RefreshControl,
  Image,
  TextInput,
  Animated
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { api, loadToken } from '../lib/api';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { Ionicons } from '@expo/vector-icons';

export default function ContactsScreen({ navigation }) {
  const [matches, setMatches] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  const animation = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open

  const normalizePhone = (raw, defaultCountry = 'NG') => {
    try {
      const phoneNumber = parsePhoneNumberFromString(raw, defaultCountry);
      if (phoneNumber) return phoneNumber.number;
    } catch {}
    return raw.replace(/[^0-9+]/g, '');
  };

  const syncContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'App needs access to contacts for friend matching.');
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });
    if (data.length === 0) return;

    const phones = [];
    data.forEach(c => {
      (c.phoneNumbers || []).forEach(p => {
        const num = normalizePhone(p.number);
        if (num) phones.push(num);
      });
    });

    try {
      setLoading(true);
      await loadToken();
      const res = await api.post('/api/contacts/sync', { phones });
      const m = res.data.matches || [];
      setMatches(m);
      setFiltered(m);
    } catch (err) {
      console.warn('contacts sync error', err.message || err);
      Alert.alert('Error', 'Could not sync contacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncContacts();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    syncContacts().finally(() => setRefreshing(false));
  }, []);

  const startChat = (otherUser) => {
    navigation.navigate('Chat', { otherUser });
  };

  const handleSearch = (text) => {
    setSearch(text);
    if (!text.trim()) {
      setFiltered(matches);
    } else {
      const t = text.toLowerCase();
      setFiltered(
        matches.filter(
          u =>
            (u.name && u.name.toLowerCase().includes(t)) ||
            (u.phone && u.phone.includes(text))
        )
      );
    }
  };

  const toggleFab = () => {
    setFabOpen(!fabOpen);
    Animated.timing(animation, {
      toValue: fabOpen ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.item} onPress={() => startChat(item)}>
      <Image 
        source={{ uri: 'https://ui-avatars.com/api/?background=25D366&color=fff&name=' + encodeURIComponent(item.name || item.phone) }}
        style={styles.avatar}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name || item.phone}</Text>
        <Text style={styles.subtitle}>{item.phone}</Text>
      </View>
    </TouchableOpacity>
  );

  // Mini FAB items
  const fabOptions = [
    { label: 'New Group', icon: 'people', action: () => navigation.navigate('NewGroup') },
    { label: 'New Contact', icon: 'person-add', action: () => navigation.navigate('NewContact') },
    { label: 'Invite Friends', icon: 'share-social', action: () => navigation.navigate('InviteFriends') },
  ];

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <TextInput
          value={search}
          onChangeText={handleSearch}
          placeholder="Search contacts"
          placeholderTextColor="#888"
          style={styles.searchInput}
        />
      </View>

      {loading && matches.length === 0 ? (
        <ActivityIndicator size="large" color="#25D366" style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(i, idx) => i._id || i.phone || idx.toString()}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#25D366']} />
          }
          ListEmptyComponent={
            !loading && (
              <Text style={styles.empty}>No matches found. Invite friends to join!</Text>
            )
          }
        />
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        {fabOptions.map((opt, idx) => {
          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -(70 * (idx + 1))], // stack upwards
          });
          return (
            <Animated.View key={opt.label} style={[styles.miniFabContainer, { transform: [{ translateY }] }]}>
              <TouchableOpacity style={styles.miniFab} onPress={opt.action}>
                <Ionicons name={opt.icon} size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.miniLabel}>{opt.label}</Text>
            </Animated.View>
          );
        })}

        {/* Main FAB */}
        <TouchableOpacity style={styles.fab} onPress={toggleFab}>
          <Ionicons name={fabOpen ? 'close' : 'chatbubble-ellipses'} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  searchContainer: {
    padding: 10,
    backgroundColor: '#f6f6f6',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#000',
  },

  item: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  avatar: { 
    width: 45, 
    height: 45, 
    borderRadius: 22.5, 
    marginRight: 12,
    backgroundColor: '#25D366',
  },
  name: { fontSize: 16, fontWeight: '600', color: '#000' },
  subtitle: { fontSize: 14, color: '#666' },
  empty: { textAlign: 'center', color: '#888', marginTop: 30 },

  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    alignItems: 'center',
  },
  fab: {
    backgroundColor: '#25D366',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  miniFabContainer: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniFab: {
    backgroundColor: '#25D366',
    width: 45,
    height: 45,
    borderRadius: 22.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  miniLabel: {
    marginRight: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 2,
    color: '#333',
    fontSize: 13,
  }
});
