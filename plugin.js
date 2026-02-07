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
                    version: '1.4.0',
                    name: 'AI Control',
                    description: 'WebSocket управление с перехватом событий',
                    component: 'ai_control',
                };
            },

            setupSettings() {
                Lampa.Settings.add({
                    title: 'AI Control',
                    type: 'category',
                    icon: '<i class="fas fa-robot"></i>',
                    section: 'ai_control'
                });
                Lampa.Settings.add({
                    name: 'ai_server_ip',
                    type: 'input',
                    default: '192.168.1.66',
                    title: 'IP Сервера',
                    section: 'ai_control'
                });
                Lampa.Settings.add({
                    name: 'ai_server_port',
                    type: 'input',
                    default: '50411',
                    title: 'Порт Сервера',
                    section: 'ai_control'
                });
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
                                    const results = items.slice(0, 7).map(item => {
                                        const d = item.data || {};
                                        return {
                                            id: d.id,
                                            title: d.title || d.name,
                                            release_date: d.release_date || d.first_air_date || '????',
                                            type: d.original_title ? 'movie' : 'tv',
                                            overview: d.overview ? d.overview.slice(0, 100) + '...' : ''
                                        };
                                    });

                                    _this.sendResponse('search', 'success', { data: results });
                                    console.log('AI-Control: Search results intercepted via build()');
                                } catch (e) {
                                    console.error('AI-Control: Intercept error', e);
                                }
                            }, 100); 
                            
                            return res;
                        };
                    }
                    return comp;
                });
            },

            connect() {
                const ip = Lampa.Storage.get('ai_server_ip', '192.168.1.66');
                const port = Lampa.Storage.get('ai_server_port', '50411');
                
                if (this.socket) this.socket.close();
                this.socket = new WebSocket(`ws://${ip}:${port}`);

                this.socket.onopen = () => Lampa.Noty.show('AI Сервер подключен');
                this.socket.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
                this.socket.onclose = () => setTimeout(() => this.connect(), 5000);
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

            actionSearch(query) {
                const source = Lampa.Storage.field('source');
                const url = source === 'cub' ? `?cat=movie&query=${encodeURIComponent(query)}` : `search/movie?query=${encodeURIComponent(query)}`;
                
                Lampa.Activity.push({
                    url: url,
                    title: 'Поиск: ' + query,
                    component: 'category_full',
                    source: source,
                    card_type: true,
                    page: 1,
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
                    this.sendResponse('play', 'error', { message: 'Button not found' });
                }
            }
        };

        AI_Control.init();
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', (e) => { if (e.type == 'ready') startPlugin(); });
})();
