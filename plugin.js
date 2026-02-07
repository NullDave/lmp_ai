(function() {
    'use strict';

    function startPlugin() {
        const AI_Control = {
            socket: null,
            serverIp: '192.168.1.66',
            port: '50411',

            init() {
                Lampa.Manifest.plugins = {
                    type: 'other',
                    version: '1.2',
                    name: 'AI Control',
                    description: 'WebSocket управление через API',
                    component: 'ai_control',
                };
                this.connect();
            },

            connect() {
                this.socket = new WebSocket(`ws://${this.serverIp}:${this.port}`);
                this.socket.onopen = () => Lampa.Noty.show('AI Сервер подключен');
                this.socket.onclose = () => setTimeout(() => this.connect(), 5000);
                this.socket.onerror = () => console.error('AI-Control: WS Error');
                this.socket.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
            },

            sendResponse(method, status, data = {}) {
                this.socket.send(JSON.stringify({ method, status, ...data }));
            },

            handleMessage(data) {
                switch (data.method) {
                    case 'search': this.actionSearch(data.query); break;
                    case 'open':   this.actionOpen(data); break;
                    case 'play':   this.actionPlay(); break;
                    case 'status': this.sendResponse('status', 'online', { app: 'Lampa' }); break;
                }
            },

            buildSearchUrl(query) {
                const source = Lampa.Storage.field('source');
                const encoded = encodeURIComponent(query);
                return {
                    source,
                    url: source === 'cub' ? `?cat=movie&query=${encoded}` : `search/movie?query=${encoded}`
                };
            },

          actionSearch(query) {
                const config = this.buildSearchUrl(query);
                
                // Создаем объект активности
                const activityData = {
                    url: config.url,
                    title: 'Поиск: ' + query,
                    component: 'category_full',
                    source: config.source,
                    card_type: true,
                    page: 1
                };

                Lampa.Activity.push(activityData);
              
                const active = Lampa.Activity.active();
                const component = active.activity.component;
                const originalOnFinished = component.onFinished;
                
                component.onFinished = () => {

                    if (originalOnFinished) originalOnFinished.apply(component);

                    try {
                        const items = component.items || [];
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

                        AI_Control.sendResponse('search', 'success', { data: results });
                        console.log('AI-Control: Data sent immediately after render');
                    } catch (e) {
                        AI_Control.sendResponse('search', 'error', { message: 'Extract error' });
                    }
                };
            },

            actionOpen(data) {
                Lampa.Activity.push({
                    url: '', 
                    component: 'full',
                    id: data.id,
                    method: data.type || 'movie',
                    card: { id: data.id, method: data.type || 'movie' },
                    source: 'tmdb'
                });
                this.sendResponse('open', 'success');
            },

            actionPlay() {
                const selectors = '.view--torrent, .button--torrent, .full-start__button:contains("Торренты")';
                const btn = $(selectors).first();
                
                if (btn.length) {
                    btn.trigger('hover:enter');
                    Lampa.Noty.show('Запуск торрентов...');
                } else {
                    Lampa.Noty.show('Кнопка торрентов не найдена');
                }
            }
        };

        AI_Control.init();
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', (e) => { if (e.type == 'ready') startPlugin(); });
})();
