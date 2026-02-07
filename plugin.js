(function() {
    'use strict';

    function startPlugin() {
        const AI_Control = {
            socket: null,
            serverIp: Lampa.Storage.get('ai_control_ip', '192.168.1.66'),
            port: Lampa.Storage.get('ai_control_port', '50411'),

            init() {
                this.setupSettings(); 
                
                Lampa.Manifest.plugins = {
                    type: 'other',
                    version: '1.3',
                    name: 'AI Control',
                    description: 'WebSocket управление через API',
                    component: 'ai_control',
                };
                this.connect();
            },

            setupSettings() {
                Lampa.Settings.listener.follow('open', (e) => {
                    if (e.name == 'main') {
                        var item = $('<div class="settings-folder selector" data-component="ai_control_settings">' +
                            '<div class="settings-folder__icon"><svg height="36" viewBox="0 0 24 24" width="36" xmlns="http://www.w3.org"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/></svg></div>' +
                            '<div class="settings-folder__name">AI Control</div>' +
                            '</div>');
                        e.body.find('.settings-list').append(item);
                    }
                });

                Lampa.Component.add('ai_control_settings', (object) => {
                    var comp = new Lampa.SettingsBase(object);
                    comp.create = function() {
                        this.add({
                            title: 'IP Сервера',
                            name: 'ai_control_ip',
                            type: 'input',
                            placeholder: '192.168.1.66',
                            value: Lampa.Storage.get('ai_control_ip', '192.168.1.66')
                        });
                        this.add({
                            title: 'Порт WebSocket',
                            name: 'ai_control_port',
                            type: 'input',
                            placeholder: '50411',
                            value: Lampa.Storage.get('ai_control_port', '50411')
                        });
                    };
                    comp.onChange = (params) => {
                        Lampa.Storage.set(params.name, params.value);
                        Lampa.Noty.show('Настройки сохранены. Перезапустите для применения.');
                    };
                    return comp;
                });
            },

            connect() {
                const ip = Lampa.Storage.get('ai_control_ip', this.serverIp);
                const port = Lampa.Storage.get('ai_control_port', this.port);
                
                this.socket = new WebSocket(`ws://${ip}:${port}`);
                this.socket.onopen = () => Lampa.Noty.show('AI Сервер подключен');
                this.socket.onclose = () => setTimeout(() => this.connect(), 5000);
                this.socket.onerror = () => console.error('AI-Control: WS Error');
                this.socket.onmessage = (e) => this.handleMessage(JSON.parse(e.data));
            },

            sendResponse(method, status, data = {}) {
                if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ method, status, ...data }));
                }
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
