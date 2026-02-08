(function() {
    'use strict';

    function startPlugin() {
        const AI_Control = {
            socket: null,
            
            init() {
                this.setupSettings();
                this.interceptComponent();
                this.connect();
                
                Lampa.Manifest.plugins = {
                    type: 'other',
                    version: '1.4.5',
                    name: 'AI Control',
                    description: 'WebSocket управление через Settings API',
                    component: 'ai_control',
                };
            },

            setupSettings() {
               const component_id = 'ai_control_settings';  
                const ip_key = 'ai_server_ip';  
                const port_key = 'ai_server_port';  
                  
                if (!Lampa.Storage.get(ip_key)) Lampa.Storage.set(ip_key, '192.168.1.66');  
                if (!Lampa.Storage.get(port_key)) Lampa.Storage.set(port_key, '50411');  
              
                Lampa.SettingsApi.addComponent({  
                    component: component_id,  
                    name: 'AI Control',  
                    icon: '<svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org"><path d="M19 13v-2c0-1.1-.9-2-2-2h-1V7c0-2.21-1.79-4-4-4S8 4.79 8 7v2H7c-1.1 0-2 .9-2 2v2c-1.1 0-2 .9-2 2v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2zM10 7c0-1.1.9-2 2-2s2 .9 2 2v2h-4V7zm10 11H4v-3h16v3z" fill="white"/></svg>'  
                });  
              
                Lampa.SettingsApi.addParam({  
                    component: component_id,  
                    param: {  
                        name: ip_key,  
                        type: 'input',  
                        values: '',                    
                        default: '192.168.1.66',       
                        placeholder: '192.168.1.66'  
                    },  
                    field: {  
                        name: 'IP Адрес сервера',  
                        description: 'Укажите IP для WebSocket'  
                    },  
                    onChange: (value) => {  
                        this.connect();  
                    }  
                });  
              
                Lampa.SettingsApi.addParam({  
                    component: component_id,  
                    param: {  
                        name: port_key,  
                        type: 'input',  
                        values: '',                   
                        default: '50411',              
                        placeholder: '50411'  
                    },  
                    field: {  
                        name: 'Порт сервера',  
                        description: 'Обычно 50411 или 8000'  
                    },  
                    onChange: (value) => {  
                        this.connect();  
                    }  
                });  
            },

            connect() {
                const ip = Lampa.Storage.get('ai_server_ip', '192.168.1.66');
                const port = Lampa.Storage.get('ai_server_port', '50411');
                
                if (this.socket) {
                    this.socket.onclose = null;
                    this.socket.close();
                }

                try {
                    this.socket = new WebSocket(`ws://${ip}:${port}`);
                    this.socket.onopen = () => Lampa.Noty.show('AI подключен к ' + ip);
                    this.socket.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
                    this.socket.onclose = () => setTimeout(() => this.connect(), 5000);
                    this.socket.onerror = () => console.error('AI-Control: WS Error');
                } catch(e) {
                    console.error('AI-Control: WS Connect fail', e);
                }
            },

            sendResponse(method, status, data = {}) {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ method, status, ...data }));
                }
            },

            handleMessage(data) {
                switch (data.method) {
                    case 'search': this.actionSearch(data.query); break;
                    case 'open':   this.actionOpen(data); break;
                    case 'play':   this.actionPlay(); break;
                    case 'status': this.sendResponse('status', 'online'); break;
                }
            },

            interceptComponent() {
                const originalComponent = Lampa.Component.get('category_full');
                const _this = this;

                Lampa.Component.add('category_full', function(object) {
                    const comp = originalComponent(object);
                    if (object.is_ai_search) {
                        const originalBuild = comp.build;
                        comp.build = function() {
                            const res = originalBuild.apply(comp, arguments);
                            setTimeout(() => {
                                try {
                                    const items = comp.items || [];
                                    const results = items.slice(0, 7).map(item => ({
                                        id: item.data.id,
                                        title: item.data.title || item.data.name,
                                        release_date: item.data.release_date || '????',
                                        type: item.data.original_title ? 'movie' : 'tv'
                                    }));
                                    _this.sendResponse('search', 'success', { data: results });
                                } catch (e) { console.error(e); }
                            }, 800);
                            return res;
                        };
                    }
                    return comp;
                });
            },

            actionSearch(query) {
                const source = Lampa.Storage.field('source');
                Lampa.Activity.push({
                    url: source === 'cub' ? `?cat=movie&query=${encodeURIComponent(query)}` : `search/movie?query=${encodeURIComponent(query)}`,
                    title: 'Поиск: ' + query,
                    component: 'category_full',
                    source: source,
                    card_type: true,
                    is_ai_search: true
                });
            },

            actionOpen(data) {
                Lampa.Activity.push({
                    component: 'full',
                    id: data.id,
                    method: data.type || 'movie',
                    card: { id: data.id, method: data.type || 'movie' },
                    source: 'tmdb'
                });
                this.sendResponse('open', 'success');
            },

            actionPlay() {
                const btn = $('.view--torrent, .button--torrent, .full-start__button:contains("Торренты")').first();
                if (btn.length) {
                    btn.trigger('hover:enter');
                    this.sendResponse('play', 'success');
                } else {
                    this.sendResponse('play', 'error');
                }
            }
        };

        AI_Control.init();
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', (e) => { if (e.type == 'ready') startPlugin(); });
})();
