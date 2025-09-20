// screens/ChatScreen.js
import React, { useEffect, useState, useRef } from 'react';
import { View, TextInput, Button, FlatList, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Image } from 'react-native';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
import { api, loadToken } from '../lib/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

function formatConvId(a, b) {
  return `priv_${a}_${b}`; // deterministic for demo
}

export default function ChatScreen({ route, navigation }) {
  const { otherUser } = route.params || {};
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) {
        navigation.replace('Auth');
        return;
      }

      const rawUser = await AsyncStorage.getItem('pizuna_user');
      const user = rawUser ? JSON.parse(rawUser) : null;
      setMe(user);

      const sock = connectSocket(token);
      socketRef.current = sock;

      sock.on('connect', () => setConnected(true));
      sock.on('disconnect', () => setConnected(false));

      sock.on('private_message', (msg) => {
        setMessages(prev => [...prev, { ...msg }]);
      });

      sock.on('message_sent', (ack) => {
        // optional: update optimistic messages
      });

      const convId = formatConvId(user?._id || user?.phone || 'me', otherUser._id || otherUser.phone || otherUser.phone);
      try {
        const res = await api.get(`/api/conversations/${convId}/messages`);
        if (res.data && res.data.messages) setMessages(res.data.messages);
      } catch (err) {}

      return () => disconnectSocket();
    })();
  }, []);

  useEffect(() => {
    if (me) AsyncStorage.setItem('pizuna_user', JSON.stringify(me));
  }, [me]);

  const sendText = async () => {
    if (!text.trim()) return;
    const s = getSocket();
    const tempId = `t_${Date.now()}`;
    const convId = formatConvId(me?._id || me?.phone || 'me', otherUser._id || otherUser.phone || otherUser.phone);
    const payload = { conversationId: convId, to: otherUser._id || otherUser.phone, body: text.trim(), tempId, type: 'text' };

    setMessages(prev => [...prev, { ...payload, from: me?._id || me?.phone, createdAt: new Date().toISOString(), _id: tempId }]);
    setText('');

    if (s && s.connected) s.emit('private_message', payload);
  };

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.cancelled) {
      try {
        const token = await loadToken();
        const uriParts = result.uri.split('/');
        const fileName = uriParts[uriParts.length - 1];
        const fileType = result.type === 'image' ? 'image/jpeg' : 'application/octet-stream';

        // 1️⃣ Get presigned URL
        const res = await api.post('/api/media/presign', { fileName, fileType });

        const { uploadUrl, fileUrl } = res.data;

        // 2️⃣ Upload file to S3
        const fileBlob = await FileSystem.readAsStringAsync(result.uri, { encoding: FileSystem.EncodingType.Base64 });
        await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': fileType },
          body: Buffer.from(fileBlob, 'base64'),
        });

        // 3️⃣ Send socket message
        const tempId = `t_${Date.now()}`;
        const convId = formatConvId(me?._id || me?.phone || 'me', otherUser._id || otherUser.phone || otherUser.phone);
        const payload = { conversationId: convId, to: otherUser._id || otherUser.phone, body: fileUrl, type: 'image', tempId };
        setMessages(prev => [...prev, { ...payload, from: me?._id || me?.phone, createdAt: new Date().toISOString(), _id: tempId }]);
        const s = getSocket();
        if (s && s.connected) s.emit('private_message', payload);

      } catch (err) {
        console.warn('media upload failed', err);
      }
    }
  };

  const renderMessage = ({ item }) => {
    const fromMe = (item.from === (me?._id || me?.phone));
    return (
      <View style={[styles.msg, fromMe ? styles.me : styles.them]}>
        {item.type === 'text' ? (
          <Text style={{ color: fromMe ? '#fff' : '#000' }}>{item.body}</Text>
        ) : (
          <Image source={{ uri: item.body }} style={{ width: 200, height: 200, borderRadius: 8 }} />
        )}
        <Text style={{ fontSize:10, color: fromMe ? '#fff' : '#666', marginTop:6 }}>{new Date(item.createdAt).toLocaleTimeString()}</Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={{ flex:1, padding:12 }}>
        <Text style={{ marginBottom:6, fontWeight:'600' }}>{otherUser?.name || otherUser?.phone}</Text>
        <FlatList
          data={messages}
          keyExtractor={item => item._id || item.createdAt}
          renderItem={renderMessage}
        />
      </View>
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickMedia} style={{ marginRight:8 }}>
          <Text style={{ fontSize:20 }}>📎</Text>
        </TouchableOpacity>
        <TextInput style={styles.input} placeholder="Type a message" value={text} onChangeText={setText} />
        <Button title="Send" onPress={sendText} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  msg: { padding:10, borderRadius:8, marginVertical:6, maxWidth:'80%' },
  me: { backgroundColor:'#0b93f6', alignSelf:'flex-end' },
  them: { backgroundColor:'#eee', alignSelf:'flex-start' },
  inputBar: { flexDirection:'row', padding:8, borderTopWidth:1, borderColor:'#eee', alignItems:'center' },
  input: { flex:1, borderWidth:1, borderColor:'#ddd', marginRight:8, borderRadius:6, paddingHorizontal:8, paddingVertical:6 }
});
