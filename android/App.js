import React, {useState} from 'react';
import {View,Text,TextInput,Button,StyleSheet,ScrollView,StatusBar,Alert} from 'react-native';

export default function App() {
  const [ip,setIp] = useState('192.168.1.42');
  const [token,setToken] = useState('');
  const [status,setStatus] = useState('Not connected');

  async function login() {
    try {
      setStatus('Logging in...');
      const r = await fetch('http://'+ip+':4000/api/auth/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email:'user@t.local',password:'t'})
      });
      const j = await r.json();
      if (j.token) {
        setToken(j.token);
        setStatus('Authenticated (token set)');
      } else {
        setStatus('Login failed: '+JSON.stringify(j));
      }
    } catch (e) {
      setStatus('Login error: '+e.message);
    }
  }

  async function pair() {
    if (!token) {
      setStatus('Please login first');
      return;
    }
    setStatus('Pairing with PC at '+ip+' (real handshake)...');
    try {
      // Step 1: initiate pairing -> get pairing code
      const init = await fetch('http://'+ip+':4000/api/pairing', {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({deviceName:'Android'})
      });
      const initJ = await init.json();
      const code = initJ.code;
      if (!code) throw new Error('no pairing code: '+JSON.stringify(initJ));
      // Step 2: authorize pairing with Bearer JWT (from login) -> receive paired token
      const auth = await fetch('http://'+ip+':4000/api/pairing/authorize', {
        method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body: JSON.stringify({code})
      });
      const authJ = await auth.json();
      if (authJ.error) throw new Error('pairing auth: '+authJ.error);
      setToken(authJ.token); // new paired token replaces login token
      setStatus('Paired — '+authJ.deviceName+' ('+code+') token: '+authJ.token.slice(0,14)+'...');
    } catch (e) {
      setStatus('Pair error: '+e.message);
    }
  }

  async function sendFile() {
    if (!token) {
      Alert.alert('Not authenticated','Run Login / Pair first');
      return;
    }
    setStatus('Starting chunked upload...');
    try {
      const s = await fetch('http://'+ip+':4000/api/transfer/sessions', {
        method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body: JSON.stringify({name:'hello.txt', size:5, chunkSize:256})
      });
      const sess = await s.json();
      const sid = sess.id;
      if (!sid) throw new Error('No session id: '+JSON.stringify(sess));
      await fetch('http://'+ip+':4000/api/transfer/sessions/'+sid+'/chunk', {
        method:'POST', headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
        body: JSON.stringify({data:'SEVMTE8='})
      });
      const confirm = await fetch('http://'+ip+':4000/api/transfer/sessions/'+sid, {
        headers:{'Authorization':'Bearer '+token}
      });
      const c = await confirm.json();
      setStatus('Sent chunk — session '+sid+' received '+(c.received||'?')+' bytes');
    } catch (e) {
      setStatus('Send error: '+e.message);
    }
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={{paddingBottom:40}}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a"/>
      <Text style={s.title}>Transfo</Text>
      <Text style={s.subtitle}>Cross-device chunked file transfer</Text>
      <Text style={s.status}>Status: {status}</Text>
      <View style={s.row}><Text style={s.label}>PC LAN IP:</Text>
        <TextInput style={s.input} value={ip} onChangeText={setIp} keyboardType="numeric" placeholder="192.168.x.x"/>
      </View>
      <Button title="Login / Pair with PC" onPress={async()=>{await login(); await pair();}} color="#d97706"/>
      <Button title="Send file (chunked)" onPress={sendFile} color="#15803d"/>
      <Text style={s.note}>Requires server at :4000 (auth + pairing + chunked — verified live). Token: {token ? 'set ('+token.slice(0,10)+'...)' : 'none'}</Text>
    </ScrollView>
  );
}
const s = StyleSheet.create({
  container:{flex:1,backgroundColor:'#0a0a0a',padding:24},
  title:{fontSize:36,fontWeight:'bold',color:'#fff',marginBottom:6},
  subtitle:{fontSize:15,color:'#888',marginBottom:24},
  status:{fontSize:14,color:'#aaa',marginBottom:18},
  row:{flexDirection:'row',alignItems:'center',marginBottom:8},
  label:{color:'#ccc',fontSize:13,width:90},
  input:{flex:1,borderColor:'#555',borderWidth:1,borderRadius:4,padding:6,color:'#fff',marginBottom:8},
  note:{fontSize:11,color:'#777',marginTop:16}
});
