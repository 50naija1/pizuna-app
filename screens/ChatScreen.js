// screens/ChatScreen.js
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  TextInput,
  FlatList,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { connectSocket, getSocket, disconnectSocket } from "../lib/socket";
import { api, loadToken } from "../lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";

function formatConvId(a, b) {
  return `priv_${a}_${b}`;
}

export default function ChatScreen({ route, navigation }) {
  const { otherUser } = route.params || {};
  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const socketRef = useRef(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    let sock;
    (async () => {
      const token = await loadToken();
      if (!token) {
        navigation.replace("Auth");
        return;
      }

      const rawUser = await AsyncStorage.getItem("pizuna_user");
      const user = rawUser ? JSON.parse(rawUser) : null;
      setMe(user);

      sock = connectSocket(token);
      socketRef.current = sock;

      sock.on("connect", () => console.log("Connected to socket"));
      sock.on("disconnect", () => console.log("Socket disconnected"));

      const onPrivateMessage = (msg) => {
        setMessages((prev) => [...prev, { ...msg, status: "sent" }]);
      };
      const onMessageSent = (ack) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.tempId === ack.tempId ? { ...m, status: "sent" } : m
          )
        );
      };

      sock.on("private_message", onPrivateMessage);
      sock.on("message_sent", onMessageSent);

      const convId = formatConvId(
        user?._id || user?.phone || "me",
        otherUser._id || otherUser.phone
      );
      try {
        const res = await api.get(`/api/conversations/${convId}/messages`);
        if (res.data && res.data.messages)
          setMessages(res.data.messages.map((m) => ({ ...m, status: "sent" })));
      } catch (err) {
        console.warn("failed to load messages", err);
      }

      return () => {
        sock.off("private_message", onPrivateMessage);
        sock.off("message_sent", onMessageSent);
        disconnectSocket();
      };
    })();

    return () => {
      if (sock) disconnectSocket();
    };
  }, []);

  useEffect(() => {
    if (me) AsyncStorage.setItem("pizuna_user", JSON.stringify(me));
  }, [me]);

  const sendText = async () => {
    if (!text.trim()) return;
    const s = getSocket();
    const tempId = `t_${Date.now()}`;
    const convId = formatConvId(
      me?._id || me?.phone || "me",
      otherUser._id || otherUser.phone
    );
    const payload = {
      conversationId: convId,
      to: otherUser._id || otherUser.phone,
      body: text.trim(),
      tempId,
      type: "text",
    };

    setMessages((prev) => [
      ...prev,
      {
        ...payload,
        from: me?._id || me?.phone,
        createdAt: new Date().toISOString(),
        _id: tempId,
        status: "pending",
      },
    ]);
    setText("");

    if (s && s.connected) s.emit("private_message", payload);
    else {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === tempId ? { ...m, status: "failed" } : m
        )
      );
    }
  };

  const pickMedia = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      try {
        const file = result.assets[0];

        // validate file size (max 10MB for example)
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          Alert.alert("File too large", "Maximum allowed size is 10MB.");
          return;
        }

        const fileName = file.uri.split("/").pop();
        const fileType =
          file.type === "image" ? "image/jpeg" : "application/octet-stream";

        // 1️⃣ Get presigned URL
        const res = await api.post("/api/media/presign", {
          fileName,
          fileType,
        });

        const { uploadUrl, fileUrl } = res.data;

        // 2️⃣ Upload file to S3
        await FileSystem.uploadAsync(uploadUrl, file.uri, {
          httpMethod: "PUT",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": fileType },
        });

        // 3️⃣ Send socket message
        const tempId = `t_${Date.now()}`;
        const convId = formatConvId(
          me?._id || me?.phone || "me",
          otherUser._id || otherUser.phone
        );
        const payload = {
          conversationId: convId,
          to: otherUser._id || otherUser.phone,
          body: fileUrl,
          type: "image",
          tempId,
        };

        setMessages((prev) => [
          ...prev,
          {
            ...payload,
            from: me?._id || me?.phone,
            createdAt: new Date().toISOString(),
            _id: tempId,
            status: "pending",
          },
        ]);

        const s = getSocket();
        if (s && s.connected) s.emit("private_message", payload);
        else {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === tempId ? { ...m, status: "failed" } : m
            )
          );
        }
      } catch (err) {
        console.warn("media upload failed", err);
        Alert.alert("Upload Failed", "Please try again.");
      }
    }
  };

  const renderMessage = ({ item }) => {
    const fromMe = item.from === (me?._id || me?.phone);
    return (
      <View style={[styles.msg, fromMe ? styles.me : styles.them]}>
        {item.type === "text" ? (
          <Text style={{ color: fromMe ? "#fff" : "#000" }}>{item.body}</Text>
        ) : (
          <Image
            source={{ uri: item.body }}
            style={{ width: 200, height: 200, borderRadius: 8 }}
          />
        )}
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Text
            style={{
              fontSize: 10,
              color: fromMe ? "#fff" : "#666",
              marginTop: 6,
              marginRight: 4,
            }}
          >
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          {fromMe && (
            <Text style={{ fontSize: 10, color: "#fff" }}>
              {item.status === "pending"
                ? "⏳"
                : item.status === "failed"
                ? "❌"
                : "✓"}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ flex: 1, padding: 12 }}>
        <Text style={{ marginBottom: 6, fontWeight: "600" }}>
          {otherUser?.name || otherUser?.phone}
        </Text>
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item) =>
            item._id?.toString() || `${item.createdAt}-${Math.random()}`
          }
          renderItem={renderMessage}
          initialNumToRender={20}
          windowSize={10}
          removeClippedSubviews
          onContentSizeChange={() =>
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true })
          }
        />
      </View>
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickMedia} style={{ marginRight: 8 }}>
          <Text style={{ fontSize: 20 }}>📎</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          placeholder="Type a message"
          value={text}
          onChangeText={setText}
        />
        <TouchableOpacity onPress={sendText} style={styles.sendBtn}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  msg: {
    padding: 10,
    borderRadius: 8,
    marginVertical: 6,
    maxWidth: "80%",
  },
  me: { backgroundColor: "#0b93f6", alignSelf: "flex-end" },
  them: { backgroundColor: "#eee", alignSelf: "flex-start" },
  inputBar: {
    flexDirection: "row",
    padding: 8,
    borderTopWidth: 1,
    borderColor: "#eee",
    alignItems: "center",
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    marginRight: 8,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sendBtn: {
    backgroundColor: "#0b93f6",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
});
