import React, {useState} from 'react';
import {View,Text,Button,StyleSheet,ScrollView,StatusBar} from 'react-native';

export default function App() {
  const [status,setStatus] = useState('Not connected');
  return (
    <ScrollView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a"/>
      <Text style={s.title}>Transfo</Text>
      <Text style={s.subtitle}>Chunked device-to-device transfer</Text>
      <Text style={s.status}>Server: {status}</Text>
      <Button title="Pair with PC" onPress={()=>setStatus('Pairing...')} color="#d97706"/>
      <Button title="Send file (stub)" onPress={()=>setStatus('Chunked upload — requires live server :4000')} color="#d97706"/>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0a0a0a',padding:24},
  title:{fontSize:36,fontWeight:'bold',color:'#fff',marginBottom:8},
  subtitle:{fontSize:16,color:'#888',marginBottom:24},
  status:{fontSize:14,color:'#aaa',marginBottom:24},
});
