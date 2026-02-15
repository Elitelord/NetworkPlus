importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJGjQDWmcMgby5vC6uGKHb1GQ8Fx880CA",
  authDomain: "networkpluspush.firebaseapp.com",
  projectId: "networkpluspush",
  storageBucket: "networkpluspush.firebasestorage.app",
  messagingSenderId: "1099046881614",
  appId: "1:1099046881614:web:eff65397e58276a64fb61f",
  measurementId: "G-6DF6R8EPE5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/icon.png', // Ensure you have an icon.png in public
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  // Handle click - open specific URL
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      // If so, focus it.
      const urlToOpen = event.notification.data?.url || '/';

      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
