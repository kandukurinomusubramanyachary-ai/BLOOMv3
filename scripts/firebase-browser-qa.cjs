const fs=require('node:fs'),path=require('node:path'),{randomUUID,randomBytes}=require('node:crypto');
const journal=path.resolve(__dirname,'../tmp/browser-qa-cleanup.json');
function createFirebaseBrowserQa(){
  const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.env.qa-preview')));
  if(env.EXPO_PUBLIC_FIREBASE_PROJECT_ID!=='bloom-mvp-14b2e')throw Error('Firebase browser QA project mismatch');
  if(fs.existsSync(journal))throw Error('A previous browser QA account requires cleanup first');
  const account={projectId:env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,email:'bloom-ui-qa-'+randomUUID()+'@example.test',password:randomBytes(24).toString('base64url')+'aA1!'};
  fs.writeFileSync(journal,JSON.stringify(account),{mode:0o600});
  return {account,async signup(page){
    await page.getByRole('tab',{name:'Sign up',exact:true}).click();
    await page.getByRole('textbox',{name:'First name',exact:true}).fill('Maya');
    await page.getByRole('textbox',{name:'Email address',exact:true}).fill(account.email);
    await page.getByRole('textbox',{name:'Password',exact:true}).fill(account.password);
    await page.getByRole('textbox',{name:'Confirm password',exact:true}).fill(account.password);
    await page.getByRole('checkbox',{name:/I agree that Bloom may securely store/}).click();
    await page.getByRole('button',{name:'Create account',exact:true}).click();
    await page.getByText('Welcome to Bloom',{exact:true}).waitFor({timeout:60000});
    console.log('PASS Firebase browser signup routes the new account directly to onboarding');
  },cleanup:()=>cleanupFirebaseBrowserQa(account,env)};
}
async function cleanupFirebaseBrowserQa(account,env){
  if(account.projectId!=='bloom-mvp-14b2e'||!/^bloom-ui-qa-[a-f0-9-]+@example\.test$/.test(account.email))throw Error('Refusing non-QA cleanup');
  const {initializeApp,deleteApp}=require('firebase/app');const {initializeAuth,inMemoryPersistence,signInWithEmailAndPassword,createUserWithEmailAndPassword,deleteUser}=require('firebase/auth');const {getFirestore,doc,deleteDoc,terminate,setLogLevel}=require('firebase/firestore');setLogLevel('silent');
  const config=Object.fromEntries(Object.entries(require('../src/services/firebaseConfiguration').FIREBASE_CONFIG_ENV_NAMES).map(([key,name])=>[key,env[name]]));
  const app=initializeApp(config,'browser-qa-cleanup-'+randomUUID());const auth=initializeAuth(app,{persistence:inMemoryPersistence});const db=getFirestore(app);
  try{let user;try{user=(await signInWithEmailAndPassword(auth,account.email,account.password)).user;}catch(error){if(error.code==='auth/invalid-credential'){user=(await createUserWithEmailAndPassword(auth,account.email,account.password)).user;}else throw error;}
    if(user.email!==account.email)throw Error('QA cleanup identity mismatch');
    await deleteDoc(doc(db,'users',user.uid));await deleteUser(user);fs.unlinkSync(journal);console.log('PASS disposable browser QA profile and login removed');
  }finally{await terminate(db);await deleteApp(app);}
}
if(require.main===module && !fs.existsSync(journal)) console.log('No pending browser QA account cleanup.');
if(require.main===module && fs.existsSync(journal)){const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.env.qa-preview')));cleanupFirebaseBrowserQa(JSON.parse(fs.readFileSync(journal)),env).catch(error=>{console.error('QA cleanup failed:',error.code||error.name);process.exitCode=1;});}
module.exports={createFirebaseBrowserQa};
