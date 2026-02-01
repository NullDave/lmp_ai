(function() {
    'use strict';

    function startPlugin() {
        Lampa.Manifest.plugins = {
            type: 'other',
            version: '1.1.0',
            name: 'AI Control',
            description: 'WebSocket управление через официальное API',
            component: 'ai_control',
        };

        let socket;
        let serverIp = '192.168.1.66'; 
        let port = '8000';

        function connect() {
            socket = new WebSocket(`ws://${serverIp}:${port}`);

            socket.onopen = function() {
                Lampa.Noty.show('AI Сервер подключен');
            };

            socket.onmessage = function(event) {
                let data = JSON.parse(event.data);

                // 1. ПОИСК 
             if (data.method === 'search') {
    let source = Lampa.Storage.field('source'); // Узнаем, какой источник выбран (cub или tmdb)
    let query_url = '';
    
    if (source === 'cub') {
        // Формат для CUB: ?cat=movie&query=название
        query_url = '?cat=movie&query=' + encodeURIComponent(data.query);
    } else {
        // Формат для TMDB: search/movie?query=название
        query_url = 'search/movie?query=' + encodeURIComponent(data.query);
    }

    // Создаем объект активности точно по твоему шаблону из функции search()
    let activity_data = {
        url: query_url,
        title: 'Поиск: ' + data.query,
        component: 'category_full',
        source: source === 'cub' ? 'cub' : 'tmdb',
        card_type: true,
        page: 1
    };

    // Выполняем переход (используем Lampa.Activity.push)
    Lampa.Activity.push(activity_data);

   // Ждем отрисовки компонентов
    setTimeout(function() {
        try {
            let active = Lampa.Activity.active();
            let items = active.activity.component.items || [];
            
            let res = items.slice(0, 7).map(item => {
                let d = item.data || {};
                return {
                    id: d.id,
                    title: d.title || d.name,
                    release_date: d.release_date || d.first_air_date || '????',
                    type: d.original_title ? 'movie' : 'tv', // Простая проверка типа
                    overview: d.overview ? d.overview.slice(0, 100) + '...' : ''
                };
            });

            socket.send(JSON.stringify({
                status: 'success',
                method: 'search',
                data: res
            }));
            
            console.log('AI-Control: Передано ИИ объектов: ' + res.length);

        } catch (e) {
            console.error('AI-Control: Data extract error', e);
            socket.send(JSON.stringify({status: 'error', message: 'Data structure mismatch'}));
        }
    }, 1800); 
}
                
                // 2. ОТКРЫТИЕ КАРТОЧКИ (через Lampa.Activity.push)
                if (data.method === 'open') {
                    Lampa.Activity.push({
                        url: '',
                        component: 'full',
                        card: { 
                            id: data.id, 
                            method: data.type || 'movie' 
                        },
                        source: 'tmdb'
                    });
                    socket.send(JSON.stringify({status: 'success', method: 'open'}));
                }

                // 3. ЗАПУСК ТОРРЕНТА (через поиск кнопки в DOM)
                if (data.method === 'play') {
                    // Используем селекторы из документации и стандартных плагинов
                    let btn = $('.view--torrent, .button--torrent, .full-start__button:contains("Торренты")');
                    if (btn.length) {
                        btn.eq(0).trigger('hover:enter'); // Эмулируем нажатие по API Lampa
                        Lampa.Noty.show('Запуск торрентов...');
                    } else {
                        Lampa.Noty.show('Кнопка торрентов не найдена');
                    }
                }

                // 4. СТАТУС
                if (data.method === 'status') {
                    socket.send(JSON.stringify({status: 'online', app: 'Lampa'}));
                }
            };

            socket.onclose = function() {
                setTimeout(connect, 5000);
            };

            socket.onerror = function(e) {
                console.log('AI-Control: WS Error');
            };
        }

        connect();
    }

    // Инициализация по документации (Lampa.Listener)
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
