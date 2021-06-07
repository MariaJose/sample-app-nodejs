import firebase from 'firebase/app';
import 'firebase/firestore';
import { SessionProps, UserData } from '../../types';

// Firebase config and initialization
// Prod applications might use config file
const { FIRE_API_KEY, FIRE_DOMAIN, FIRE_PROJECT_ID } = process.env;

const firebaseConfig = {
    apiKey: FIRE_API_KEY,
    authDomain: FIRE_DOMAIN,
    projectId: FIRE_PROJECT_ID,
};

if (!firebase.apps.length) {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app();
}

const db = firebase.firestore();

// Firestore data management functions

// Use setUser for storing global user data (persists between installs)
export async function setUser({ user }: SessionProps) {
    if (!user) return null;

    const { email, id, username } = user;
    const ref = db.collection('users').doc(String(id));
    const data: UserData = { email };

    if (username) {
        data.username = username;
    }

    await ref.set(data, { merge: true });
}

export async function setStore(session: SessionProps) {
    const { access_token: accessToken, context, scope, user: { id } } = session;
    // Only set on app install or update
    if (!accessToken || !scope) return null;

    const storeHash = context?.split('/')[1] || '';
    const ref = db.collection('store').doc(storeHash);
    const data = { accessToken, adminId: id, scope };

    await ref.set(data);
}

// User management for multi-user apps
// Use setStoreUser for storing store specific variables
export async function setStoreUser(session: SessionProps) {
    const { access_token: accessToken, context, user: { id: userId } } = session;
    if (!userId) return null;

    const storeHash = context?.split('/')[1] || '';
    const collection = db.collection('storeUsers');
    const documentId = `${userId}_${storeHash}`; // users can belong to multiple stores
    const ref = collection.doc(documentId);
    const storeUser = await ref.get();

    // Set admin (store owner) if installing/ updating the app
    // https://developer.bigcommerce.com/api-docs/apps/guide/users
    if (accessToken) {
        // Create a new admin user if none exists
        if (!storeUser?.exists) {
            await ref.set({ storeHash, isAdmin: true });
        } else if (!storeUser.data()?.isAdmin) {
            await ref.update({ isAdmin: true });
        }
    } else {
        // Create a new user if it doesn't exist (non-store owners added here for multi-user apps)
        if (!storeUser?.exists) {
            await ref.set({ storeHash, isAdmin: false });
        }
    }
}

export async function deleteUser({ user }: SessionProps) {
    const storeUsersRef = db.collection('storeUsers').doc(String(user?.id));

    await storeUsersRef.delete();
}

export async function getStoreToken(storeHash: string) {
    if (!storeHash) return null;
    const storeDoc = await db.collection('store').doc(storeHash).get();

    return storeDoc?.exists ? storeDoc.data()?.accessToken : null;
}

export async function deleteStore({ store_hash: storeHash }: SessionProps) {
    const ref = db.collection('store').doc(storeHash);

    await ref.delete();
}