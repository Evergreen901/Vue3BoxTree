import { createApp } from 'vue'

let app = createApp({});

import Home from './Home.vue'
app.component("Home", Home);

var vm = app.mount('#app');
window.vm = vm;
