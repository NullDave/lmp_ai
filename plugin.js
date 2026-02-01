(function() {
    'use strict';

    function startPlugin() {
        // 1. Регистрируем манифест, чтобы Lampa видела плагин в списке
        Lampa.Manifest.plugins = {
            type: 'other',
            version: '1.0.3',
            name: 'AI Control Server',
            description: 'Управление Лампой через WebSocket для ИИ',
            component: 'ai_control',
        };

        let socket;
        let serverIp = '192.168.1.66'; // IP твоего Python-сервера

        function connect() {
            console.log('AI-Control: Trying to connect to', serverIp);
            socket = new WebSocket(`ws://${serverIp}:8000`);

            socket.onopen = function() {
                console.log('AI-Control: Connected to AI Server');
                Lampa.Noty.show('AI Сервер подключен');
            };

            socket.onmessage = function(event) {
                let data = JSON.parse(event.data);
                console.log('AI-Control: Message received', data);

                // МЕТОД ПОИСКА
                if (data.method === 'search') {
                Lampa.Input.search(data.query);
    
                // Ждем отрисовки интерфейса
                setTimeout(function() {
                    try {
                        let items = Lampa.Activity.active().items || [];
                        let res = items.slice(0, 5).map(i => ({
                            id: i.id, 
                            title: i.name || i.title,
                            type: i.type || 'movie'
                        }));
                        
                        // ОБЯЗАТЕЛЬНО JSON.stringify
                        socket.send(JSON.stringify({
                            type: 'search_results', 
                            data: res
                        }));
                        
                        console.log('AI-Control: Results sent to server');
                    } catch (e) {
                        console.error('AI-Control: Search error', e);
                        socket.send(JSON.stringify({type: 'error', message: e.message}));
                    }
                }, 2000);
            }
                            // МЕТОД ОТКРЫТИЯ КАРТОЧКИ
                if (data.method === 'open') {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        card: { id: data.id, method: data.type || 'movie' },
                        source: 'tmdb'
                    });
                }

                // МЕТОД ЗАПУСКА ТОРРЕНТА
                if (data.method === 'play') {
                    // Ищем кнопку торрентов в текущем UI
                    let btn = $('.view--torrent, .button--torrent, .button--play');
                    if (btn.length) {
                        btn.eq(0).click();
                        Lampa.Noty.show('Запускаю торрент...');
                    } else {
                        Lampa.Noty.show('Кнопка запуска не найдена');
                    }
                }
            };

            socket.onerror = function(e) {
                console.log('AI-Control: WebSocket Error', e);
            };

            socket.onclose = function() {
                console.log('AI-Control: Connection lost. Retry in 5s...');
                setTimeout(connect, 5000);
            };
        }

        // Запускаем подключение
        connect();
    }

    // Ожидание готовности приложения
    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') {
                startPlugin();
            }
        });
    }
})();
