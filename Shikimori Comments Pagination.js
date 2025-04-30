// ==UserScript==
// @name         Shikimori Comments Pagination
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Пагинация комментариев
// @author       YourName
// @match        https://shikimori.one/*
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';


    const COMMENTS_PER_PAGE = 5; // Число комментариев на странице
    const CHECK_INTERVAL = 500; // Частота проверки элементов на странице (Не ставить сликшом маленький)



    GM_addStyle(`
        .shiki-comments-pagination {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 20px 0;
            gap: 10px;
            padding: 10px;
            background: #f8f8f8;
            border-radius: 4px;
        }
        .shiki-comments-pagination button {
            background: #579;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            min-width: 30px;
            transition: background 0.2s;
        }
        .shiki-comments-pagination button:hover {
            background: #467;
        }
        .shiki-comments-pagination button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .shiki-comments-pagination input {
            width: 60px;
            text-align: center;
            padding: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .shiki-comments-pagination .page-info {
            margin: 0 10px;
            font-size: 14px;
        }
        .shiki-comments-loading {
            opacity: 0.7;
            pointer-events: none;
        }
        .b-spoiler_inline.opened {
         background-color: #f5f5f5;
         color: #333;
         padding: 2px 4px;
         border-radius: 3px;
          box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
}
    `);

    /* ========== ОБРАБОТКА СПОЙЛЕРОВ И УДАЛЕНИЯ ========== */

    // Функция для раскрытия/закрытия inline-спойлеров (текстовых)
    function bindSpoilerDeleteButtons(container) {
        container.querySelectorAll('.b-spoiler_inline').forEach(spoiler => {
            spoiler.addEventListener('click', async () => {
                if (spoiler.classList.contains('opened')) {
                    // Если спойлер уже открыт - закрываем его
                    const originalContent = spoiler.dataset.originalContent;
                    if (originalContent) {
                        spoiler.innerHTML = originalContent;
                    }
                    spoiler.classList.remove('opened');
                } else {
                    // Если спойлер закрыт - открываем его
                    spoiler.dataset.originalContent = spoiler.innerHTML;
                    const text = spoiler.textContent.trim();
                    spoiler.innerHTML = text;
                    spoiler.classList.add('opened');
                }
            });
        });
    }
    /**
 * Заменяет все даты в комментариях на относительное время (например, "2 часа назад").
 * @param {HTMLElement|string} container - Контейнер с комментариями (DOM-элемент или CSS-селектор).
 */
    function replaceCommentDates(container) {
        // Если передан селектор, находим контейнер
        const commentsContainer = typeof container === 'string'
        ? document.querySelector(container)
        : container;

        if (!commentsContainer) {
            console.error('Контейнер с комментариями не найден!');
            return;
        }

        // Находим все даты внутри контейнера
        const dateElements = commentsContainer.querySelectorAll('time[datetime]');

        dateElements.forEach((dateElement) => {
            const dateTime = dateElement.getAttribute('datetime');
            if (!dateTime) return;

            const relativeTime = getRelativeTime(dateTime);
            dateElement.textContent = relativeTime;
            dateElement.setAttribute('title', new Date(dateTime).toLocaleString()); // Подсказка с полной датой
        });
    }

    // Вспомогательная функция для форматирования времени
    function getRelativeTime(dateTime) {
        const now = new Date();
        const past = new Date(dateTime);
        const diffInSeconds = Math.floor((now - past) / 1000);

        const intervals = {
            год: { seconds: 31536000, endings: ['год', 'года', 'лет'] },
            месяц: { seconds: 2592000, endings: ['месяц', 'месяца', 'месяцев'] },
            неделя: { seconds: 604800, endings: ['неделя', 'недели', 'недель'] },
            день: { seconds: 86400, endings: ['день', 'дня', 'дней'] },
            час: { seconds: 3600, endings: ['час', 'часа', 'часов'] },
            минута: { seconds: 60, endings: ['минута', 'минуты', 'минут'] },
            секунда: { seconds: 1, endings: ['секунда', 'секунды', 'секунд'] },
        };

        for (const [unit, data] of Object.entries(intervals)) {
            const interval = Math.floor(diffInSeconds / data.seconds);
            if (interval >= 1) {
                // Правильное склонение для русского языка
                let ending;
                if (interval % 10 === 1 && interval % 100 !== 11) {
                    ending = data.endings[0]; // 1 минута, 1 день
                } else if ([2, 3, 4].includes(interval % 10) && ![12, 13, 14].includes(interval % 100)) {
                    ending = data.endings[1]; // 2 минуты, 3 дня
                } else {
                    ending = data.endings[2]; // 5 минут, 11 дней
                }
                return `${interval} ${ending} назад`;
            }
        }

        return "только что";
    }
    // Функция для раскрытия block-спойлеров (с контентом)
    function bindSpoilerBlockButtons(container) {
        const spoilerStyles = document.createElement('style');
        spoilerStyles.textContent = `
        .b-spoiler_block.to-process {
            cursor: pointer;
            display: inline;
            margin: 0 1px;
        }
        .b-spoiler_block.to-process > span[tabindex="0"] {
            display: inline;
            padding: 1px 4px;
            background-color: #687687;
            color: #fff;
            font-size: 12px;
            font-family: inherit;
            border-radius: 2px;
            transition: all 0.15s ease;
            line-height: 1.3;
        }
        .b-spoiler_block.to-process:hover > span[tabindex="0"] {
            background-color: #5a6775;
        }
        .b-spoiler_block.to-process.is-opened > span[tabindex="0"] {
            background-color: #f5f5f5;
            color: #333;
            box-shadow: 0 0 0 1px rgba(0,0,0,0.1);
        }
        .b-spoiler_block.to-process > div {
            display: none;
            margin-top: 3px;
            padding: 5px;
            background: #f5f5f5;
            border-radius: 2px;
            border: 1px solid #e0e0e0;
        }
        .b-spoiler_block.to-process.is-opened > div {
            display: block;
        }
    `;
        document.head.appendChild(spoilerStyles);

        // Остальная часть функции остается без изменений
        container.querySelectorAll('.b-spoiler_block.to-process').forEach(spoilerBlock => {
            const spoilerTitle = spoilerBlock.querySelector('span[tabindex="0"]');
            const contentDiv = spoilerBlock.querySelector('div');

            if (!spoilerTitle || !contentDiv) return;

            contentDiv.style.display = 'none';

            spoilerTitle.addEventListener('click', (e) => {
                e.stopPropagation();

                if (contentDiv.style.display === 'none') {
                    contentDiv.style.display = 'block';
                    spoilerBlock.classList.add('is-opened');
                    initImageModalViewer(contentDiv);
                } else {
                    contentDiv.style.display = 'none';
                    spoilerBlock.classList.remove('is-opened');
                }
            });
        });

        initImageModalViewer(container);
        initVideoModalViewer(container);
    }
    // Функция для обработки обычных спойлеров
    function bindSpoilerInlineBlocks(container) {
        container.querySelectorAll('.b-spoiler.unprocessed').forEach(spoiler => {
            spoiler.addEventListener('click', () => {
                // Заменяем спойлер на его содержимое
                const innerDiv = spoiler.querySelector('.content').querySelector('.inner');
                if (innerDiv) {
                    spoiler.replaceWith(innerDiv.cloneNode(true));
                }
            });
        });
    }
    // Кликабельность картинок
    function initImageModalViewer(container) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 9999;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        cursor: zoom-out;
        align-items: center;
        justify-content: center;
        overflow: auto;
    `;

        const img = document.createElement('img');
        img.style.cssText = `
        max-width: 90vw;
        max-height: 90vh;
        display: block;
        cursor: default;
        object-fit: contain;
        animation: fadeInScale 0.3s ease-out;
    `;

        const closeBtn = document.createElement('span');
        closeBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 30px;
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
        color: white;
        transition: color 0.2s;
        text-shadow: 0 0 5px rgba(0,0,0,0.8);
        z-index: 10000;
    `;
        closeBtn.innerHTML = '&times;';

        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
        document.head.appendChild(style);

        modal.append(img, closeBtn);
        document.body.append(modal);

        // Функции управления
        const open = src => {
            img.src = src.replace('/thumbnail/', '/original/').replace('/x48/', '/x160/');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';

            // Сброс стилей перед загрузкой нового изображения
            img.style.width = 'auto';
            img.style.height = 'auto';

            return false;
        };

        const close = () => {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        // Обработчики событий
        modal.onclick = e => {
            if (e.target === modal || e.target === img) {
                close();
            }
        };
        closeBtn.onclick = close;
        document.addEventListener('keydown', e => e.key === 'Escape' && close());

        // Получаем контейнер
        const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;

        if (!containerEl) return;

        // Обрабатываем изображения без изменения их исходного отображения
        containerEl.querySelectorAll('img').forEach(el => {
            // Пропускаем изображения без src или те, что находятся внутри .b-video
            if (!el.src || el.closest('.b-video')) return;

            // Сохраняем исходные стили
            const originalStyles = el.getAttribute('style');

            // Создаем копию изображения для превью
            const preview = el.cloneNode(true);

            // Добавляем обработчик клика
            preview.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Открываем оригинальное изображение в модальном окне
                const originalSrc = el.src
                .replace('/thumbnail/', '/original/')
                .replace('/x48/', '/x160/')
                .replace('/small/', '/large/');

                open(originalSrc);
            });

            // Заменяем оригинальное изображение на нашу копию
            el.parentNode.replaceChild(preview, el);

            // Восстанавливаем исходные стили
            if (originalStyles) {
                preview.setAttribute('style', originalStyles);
            }

            // Добавляем cursor: zoom-in только если его нет в исходных стилях
            if (!originalStyles || !originalStyles.includes('cursor:')) {
                preview.style.cursor = 'zoom-in';
            }
        });
    }
    function initVideoModalViewer(container) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.style.cssText = `
        display: none;
        position: fixed;
        z-index: 9999;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.95);
        cursor: zoom-out;
        align-items: center;
        justify-content: center;
        overflow: auto;
    `;

        const videoContainer = document.createElement('div');
        videoContainer.style.cssText = `
        position: relative;
        width: 90vw;
        max-width: 1200px;
        height: 0;
        padding-bottom: 56.25%; /* 16:9 */
        animation: fadeInScale 0.3s ease-out;
    `;

        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        border: none;
    `;
        iframe.setAttribute('allowfullscreen', '');
        iframe.setAttribute('allow', 'autoplay');

        const closeBtn = document.createElement('span');
        closeBtn.style.cssText = `
        position: fixed;
        top: 20px;
        right: 30px;
        font-size: 40px;
        font-weight: bold;
        cursor: pointer;
        color: white;
        transition: color 0.2s;
        text-shadow: 0 0 5px rgba(0,0,0,0.8);
        z-index: 10000;
    `;
        closeBtn.innerHTML = '&times;';

        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
    `;
        document.head.appendChild(style);

        videoContainer.appendChild(iframe);
        modal.append(videoContainer, closeBtn);
        document.body.append(modal);

        // Функции управления
        const open = videoId => {
            iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            return false;
        };

        const close = () => {
            iframe.src = '';
            modal.style.display = 'none';
            document.body.style.overflow = '';
        };

        // Обработчики событий
        modal.onclick = e => {
            if (e.target === modal) {
                close();
            }
        };
        closeBtn.onclick = close;
        document.addEventListener('keydown', e => e.key === 'Escape' && close());

        // Получаем контейнер
        const containerEl = typeof container === 'string'
        ? document.querySelector(container)
        : container;

        if (!containerEl) return;

        // Обрабатываем видео-превью
        containerEl.querySelectorAll('.b-video.youtube .video-link').forEach(link => {
            // Пропускаем, если нет data-href
            if (!link.dataset.href) return;

            // Получаем ID видео YouTube
            const youtubeUrl = link.dataset.href;
            const videoId = youtubeUrl.match(/embed\/([^?]+)/)?.[1] ||
                  youtubeUrl.match(/youtu\.be\/([^?]+)/)?.[1] ||
                  youtubeUrl.match(/v=([^&]+)/)?.[1];

            if (!videoId) return;

            // Находим превью-картинку
            const preview = link.querySelector('img');
            if (!preview) return;

            // Добавляем атрибут, чтобы image-viewer его игнорировал
            preview.setAttribute('data-video-preview', 'true');

            // Сохраняем исходные стили
            const originalStyles = preview.getAttribute('style');

            // Добавляем обработчик клика
            link.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                open(videoId);
            });

            // Добавляем cursor: zoom-in, если не задан
            if (!originalStyles || !originalStyles.includes('cursor:')) {
                preview.style.cursor = 'zoom-in';
            }
        });
    }
    // Функция для цитирования
    function setupSimpleQuoteButtons(container) {
        if (!container) {
            console.error('Container not found');
            return;
        }

        // Находим редактор как следующий элемент после контейнера
        const editorContainer = container.nextElementSibling?.classList.contains('editor-container')
        ? container.nextElementSibling
        : container.nextElementSibling?.nextElementSibling;

        const editor = editorContainer?.querySelector('.editor-area');

        container.querySelectorAll('.item-quote').forEach(button => {
            button.classList.add('is-active');
            button.classList.remove('to-process');

            button.addEventListener('click', function(e) {
                e.preventDefault();

                const comment = this.closest('.b-comment');
                if (!comment) return;

                // Получаем данные комментария
                const commentId = comment.id || comment.getAttribute('data-track_comment');
                const userId = comment.getAttribute('data-user_id');
                const userName = comment.getAttribute('data-user_nickname');

                // Получаем текст комментария
                const commentBody = comment.querySelector('.body');
                if (!commentBody) return;

                const textToQuote = commentBody.textContent.trim();

                // Формируем цитату
                const quote = `[quote=${commentId};${userId};${userName}]${textToQuote}[/quote]\n\n`;

                // Вставляем в редактор, если он найден
                if (editor) {
                    // Добавляем перенос, если уже есть текст
                    const prefix = editor.value.trim() ? '\n\n' : '';
                    editor.value += prefix + quote;
                    editor.focus();

                    // Показываем редактор
                    if (editorContainer) {
                        editorContainer.style.display = 'block';
                        editorContainer.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }
                }
            });
        });
    }
    // Функция для редактирования комментария
    function setupEditButtons(container) {
        container.querySelectorAll('.item-edit').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();

                const comment = this.closest('.b-comment');
                if (!comment) return;

                // Получаем ID комментария
                const commentId = comment.id || comment.getAttribute('data-track_comment');

                // Загружаем форму редактирования
                fetch(`https://shikimori.one/comments/${commentId}/edit`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                })
                    .then(response => response.text())
                    .then(html => {
                    // Создаем временный элемент для парсинга HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    const form = doc.querySelector('.edit_comment');

                    if (form) {
                        // Заменяем содержимое комментария на форму редактирования
                        comment.querySelector('.inner').innerHTML = form.outerHTML;
                        comment.querySelector('.inner').classList.add('is-editing');

                        // Инициализируем редактор
                        initEditor(comment);

                        // Настраиваем обработчик отправки формы
                        setupEditFormSubmit(comment, commentId);
                    }
                })
                    .catch(error => {
                    console.error('Error loading edit form:', error);
                });
            });
        });
    }

    function initEditor(comment) {
        // Здесь можно добавить инициализацию редактора, если требуется
        const textarea = comment.querySelector('.editor-area');
        if (textarea) {
            textarea.focus();
        }
    }

    function setupEditFormSubmit(comment, commentId) {
        const form = comment.querySelector('.edit_comment');
        if (!form) return;

        form.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(form);

            fetch(form.action, {
                method: 'PATCH',
                body: formData,
                headers: {
                    'Accept': 'application/json',
                    'X-CSRF-Token': form.querySelector('[name="authenticity_token"]').value,
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            })
                .then(response => response.json())
                .then(data => {
                if (data.content) {
                    // Обновляем содержимое комментария
                    const inner = comment.querySelector('.inner');
                    inner.classList.remove('is-editing');
                    inner.innerHTML = data.content;

                    // Можно добавить обработчики снова
                    setupEditButtons(comment.parentElement);
                }
            })
                .catch(error => {
                console.error('Error submitting edit:', error);
            });
        });

        // Обработчик кнопки "Отмена"
        const cancelButton = comment.querySelector('.cancel');
        if (cancelButton) {
            cancelButton.addEventListener('click', function(e) {
                e.preventDefault();
                // Загружаем оригинальный комментарий
                fetch(`https://shikimori.one/comments/${commentId}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    credentials: 'same-origin'
                })
                    .then(response => response.text())
                    .then(html => {
                    comment.querySelector('.inner').innerHTML = html;
                    comment.querySelector('.inner').classList.remove('is-editing');
                });
            });
        }
    }

    // Функция для ответа на комментарий
    function setupReplyButtons(container) {
        container.querySelectorAll('.item-reply').forEach(button => {
            button.addEventListener('click', function(e) {
                e.preventDefault();

                const comment = this.closest('.b-comment');
                if (!comment) return;

                // Получаем ID комментария и пользователя
                const commentId = comment.getAttribute('data-track_comment') ||
                      comment.id.replace('comment-', '');
                const userId = comment.getAttribute('data-user_id');
                const userName = comment.getAttribute('data-user_nickname');

                // Формируем упоминание
                const mention = `[comment=${commentId};${userId}], `;

                // Ищем редактор относительно контейнера (аналогично функции цитирования)
                const editorContainer = container.nextElementSibling?.classList.contains('editor-container')
                ? container.nextElementSibling
                : container.nextElementSibling?.nextElementSibling;

                const editor = editorContainer?.querySelector('.editor-area');

                if (editor) {
                    editor.value += mention;
                    editor.focus();

                    if (editorContainer) {
                        editorContainer.style.display = 'block';
                        editorContainer.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }
                }
            });
        });
    }
    // Настраивает кнопки модерации для комментариев в указанном контейнере

    function setupModerationButtons(container) {
        if (!container) return;

        // Получаем CSRF-токен из мета-тегов
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
        if (!csrfToken) {
            console.error('CSRF token not found');
            return;
        }

        container.addEventListener('click', async (e) => {
            const target = e.target;
            const comment = target.closest('.b-comment');

            // Кнопка "На модерацию"
            if (target.classList.contains('item-moderation')) {
                e.preventDefault();
                toggleModerationPanel(comment);
                return;
            }

            // Кнопка "Отмена"
            if (target.classList.contains('item-moderation-cancel')) {
                e.preventDefault();
                toggleModerationPanel(comment, false);
                return;
            }

            // Обработка действий модерации
            const actionBtn = target.closest('[data-action]');
            if (actionBtn?.closest('.moderation-controls')) {
                e.preventDefault();
                await handleModerationAction(actionBtn, csrfToken);
            }
        });

        function toggleModerationPanel(comment, show) {
            if (!comment) return;

            const mainControls = comment.querySelector('.main-controls');
            const modControls = comment.querySelector('.moderation-controls');

            if (!mainControls || !modControls) return;

            const showPanel = typeof show === 'boolean' ? show : modControls.style.display !== 'block';
            mainControls.style.display = showPanel ? 'none' : '';
            modControls.style.display = showPanel ? 'block' : 'none';
        }

        async function handleModerationAction(button, token) {
            const actionUrl = button.getAttribute('data-action');
            const method = button.getAttribute('data-method') || 'POST';

            // Проверка подтверждения для действий
            if (!await verifyAction(button)) return;

            try {
                // Особый обработчик для бана (открывает новое окно)
                if (button.classList.contains('item-ban')) {
                    window.open(actionUrl, '_blank');
                    return;
                }

                // Подготовка данных запроса
                const headers = {
                    'X-CSRF-Token': token,
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json'
                };

                let requestOptions = { method, headers, credentials: 'same-origin' };

                // Для POST-запросов добавляем FormData
                if (method === 'POST') {
                    const formData = new FormData();
                    formData.append('authenticity_token', token);
                    requestOptions.body = formData;
                }

                const response = await fetch(actionUrl, requestOptions);

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                updateUI(button, data);

            } catch (error) {
                console.error('Moderation failed:', error);
                alert('Ошибка при выполнении действия');
            }
        }

        async function verifyAction(button) {
            const confirmAdd = button.getAttribute('data-confirm-add');
            const confirmRemove = button.getAttribute('data-confirm-remove');

            if (!confirmAdd && !confirmRemove) return true;

            const isActive = button.classList.contains('selected');
            const message = isActive ? confirmRemove : confirmAdd;

            return message ? confirm(message) : true;
        }

        function updateUI(button, response) {
            const comment = button.closest('.b-comment');
            if (!comment) return;

            // Обновление маркера оффтопика
            if (button.classList.contains('item-offtopic')) {
                const marker = comment.querySelector('.b-offtopic_marker');
                if (marker) {
                    button.classList.toggle('selected');
                    marker.style.display = button.classList.contains('selected') ? 'block' : 'none';
                }
            }

            // Закрытие панели модерации
            toggleModerationPanel(comment, false);

            // Дополнительные обновления интерфейса на основе response
            console.log('Moderation success:', response);
        }
    }

    // Инициализация для всех контейнеров
    function initModerationSystem() {
        document.querySelectorAll('.b-comments').forEach(container => {
            setupModerationButtons(container);
        });
    }

    // Функция для обработки кнопок удаления комментариев
    function bindDeleteButtons(container) {
        container.querySelectorAll('.item-delete').forEach(button => {
            button.addEventListener('click', async () => {
                // Находим родительский комментарий
                const comment = button.closest('.b-comment');
                if (!comment) return;
                // Получаем URL для удаления
                const deleteUrl = comment.querySelector('.item-delete-confirm')?.getAttribute('data-action');
                if (!deleteUrl) return;
                // Подтверждение перед удалением
                if (!confirm('Удалить комментарий?')) return;

                try {
                    // Отправляем DELETE-запрос
                    const response = await fetch(deleteUrl, {
                        method: 'DELETE',
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest',
                            'Accept': 'application/json'
                        }
                    });

                    if (response.ok) {
                        comment.remove();
                    } else {
                        console.error('Ошибка удаления комментария:', await response.text());
                        alert('Не удалось удалить комментарий.');
                    }
                } catch (err) {
                    console.error('Ошибка удаления:', err);
                    alert('Ошибка сети при удалении.');
                }
            });
        });
    }

    /* ========== КЛАСС ДЛЯ РАБОТЫ С БЛОКАМИ КОММЕНТАРИЕВ ========== */

    class CommentsBlock {
        constructor(container) {
            // Инициализация свойств
            this.container = container; // DOM-элемент контейнера
            this.loader = container.querySelector('.comments-loader'); // Элемент загрузки
            this.fetchId = null; // ID для запросов
            this.topicId = null; // ID темы
            this.currentPage = 1; // Текущая страница
            this.totalPages = 1; // Всего страниц
            this.pagination = null; // Элемент пагинации

            this.init();
        }

        // Основная инициализация
        init() {
            if (!this.loader) return;

            // Получаем ID из data-атрибутов
            const ids = this.getCommentsIDs();
            if (!ids) return;

            this.fetchId = ids.fetchId;
            this.topicId = ids.topicId;

            // Рассчитываем общее количество страниц
            const commentsCount = parseInt(this.loader.getAttribute('data-count')) || 0;
            this.totalPages = Math.max(1, Math.ceil(commentsCount / COMMENTS_PER_PAGE));
        }

        // Создание и загрузка блока комментариев
        async CreateCommentsBlock() {
            // Проверяем наличие всех необходимых данных перед загрузкой
            if (!this.hasRequiredAttributes()) {
                console.error('Cannot create comments block - missing required attributes');
                return false;
            }

            await this.loadComments();
            this.renderPagination();
        }

        // Проверка наличия всех необходимых атрибутов
        hasRequiredAttributes() {
            if (!this.loader) {
                console.error('Missing comments loader element');
                return false;
            }

            const urlTemplate = this.loader.getAttribute('data-clickloaded-url-template');
            if (!urlTemplate) {
                console.error('Missing data-clickloaded-url-template attribute');
                return false;
            }

            this.ids = this.getCommentsIDs();
            if (!this.ids || !this.ids.fetchId || !this.ids.topicId) {
                console.error('Invalid or missing IDs in URL template');
                return false;
            }

            const count = this.loader.getAttribute('data-count');
            if (!count) {
                console.error('Missing data-count attribute');
                return false;
            }

            return true;
        }

        // Получение ID из URL шаблона с дополнительной проверкой
        getCommentsIDs() {
            try {
                const urlTemplate = this.loader.getAttribute('data-clickloaded-url-template');
                if (!urlTemplate) return null;

                const matches = urlTemplate.match(/\/fetch\/(\d+)\/Topic\/(\d+)/);
                if (!matches || matches.length < 3) return null;

                return {
                    fetchId: matches[1],
                    topicId: matches[2]
                };
            } catch (error) {
                console.error('Error parsing comment IDs:', error);
                return null;
            }
        }
        buildCommentsUrl(offset) {
            return `https://shikimori.one/comments/fetch/${this.fetchId}/Topic/${this.topicId}/${offset}/${COMMENTS_PER_PAGE}`;
        }

        /**
 * Загружает комментарии с автоматическим повтором при ошибках
 * @param {string} url - URL для запроса
 * @param {number} [maxRetries] - Максимальное количество попыток (по умолчанию: 4)
 * @param {number} [retryDelay] - Задержка между попытками в миллисекундах (по умолчанию: 2 секунды)
 * @returns {Promise<string>} HTML-контент комментариев
 * @throws {Error} Если все попытки завершились ошибкой
 */
        async fetchComments(url, maxRetries = 4, initialRetryDelay = 2000) {
            let lastError = null;

            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    const response = await fetch(url);

                    // Обработка HTTP-ошибок
                    if (!response.ok) {
                        // Особый случай: Too Many Requests (429)
                        if (response.status === 429) {
                            const retryAfter = parseInt(response.headers.get('Retry-After') || initialRetryDelay / 1000, 10);
                            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                            continue; // Повторяем попытку без увеличения счетчика
                        }
                        throw new Error(`HTTP error ${response.status} ${response.statusText}`);
                    }

                    const data = await response.json();
                    if (!data?.content) throw new Error('Invalid response format: missing content');
                    return data.content;

                } catch (error) {
                    lastError = error;

                    if (attempt < maxRetries) {
                        const currentDelay = initialRetryDelay * Math.pow(2, attempt - 1);
                        await new Promise(resolve => setTimeout(resolve, currentDelay));
                    }
                }
            }

            throw lastError || new Error('All retry attempts failed');
        }
        // Основная функция загрузки
        async loadComments() {
            try {
                const offset = (this.currentPage - 1) * COMMENTS_PER_PAGE;
                this.container.classList.add('shiki-comments-loading');

                const html = await this.fetchComments(this.buildCommentsUrl(offset));
                this.replaceComments(html);
            } catch (error) {
                console.error('Ошибка загрузки комментариев:', error);
            } finally {
                this.container.classList.remove('shiki-comments-loading');
            }
        }

        // Замена содержимого блока комментариев
        replaceComments(html) {
            this.container.innerHTML = html;
            this.loader = this.container.querySelector('.comments-loader');
            bindDeleteButtons(this.container);

            // Привязываем обработчики событий к новым элементам
            bindSpoilerDeleteButtons(this.container);
            bindSpoilerBlockButtons(this.container);
            bindSpoilerInlineBlocks(this.container);
            replaceCommentDates(this.container);
            setupReplyButtons(this.container);
            setupSimpleQuoteButtons(this.container);
            setupEditButtons(this.container);
            setupModerationButtons(this.container);
            initImageModalViewer(this.container);
            initVideoModalViewer(this.container);
        }

        // Создание интерфейса пагинации
        renderPagination() {
            if (this.pagination) {
                this.pagination.remove(); // Удаляем старую пагинацию
            }

            // Создаем новый элемент пагинации
            this.pagination = document.createElement('div');
            this.pagination.className = 'shiki-comments-pagination';
            this.pagination.innerHTML = `
                <button class="prev-page">&lt; Назад</button>
                <span class="page-info">Страница ${this.currentPage} из ${this.totalPages}</span>
                <input type="number" class="page-input" min="1" max="${this.totalPages}" value="${this.currentPage}">
                <button class="next-page">Вперед &gt;</button>
            `;

            // Находим editor-container (может быть рядом с контейнером или в другом месте)
            const editorContainer = this.container.closest('.b-topic')?.querySelector('.editor-container') ||
                  document.querySelector('.editor-container');

            // Вставляем после editor-container если найден, иначе после контейнера комментариев
            const insertAfter = editorContainer || this.container;
            insertAfter.parentNode.insertBefore(this.pagination, insertAfter.nextSibling);


            // Обработчики событий для кнопок пагинации
            this.pagination.querySelector('.prev-page').addEventListener('click', async () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    await this.loadComments();
                    this.renderPagination(); // Обновляем отображение
                }
            });

            // Обработчик для поля ввода страницы
            this.pagination.querySelector('.next-page').addEventListener('click', async () => {
                if (this.currentPage < this.totalPages) {
                    this.currentPage++;
                    await this.loadComments();
                    this.renderPagination();
                }
            });

            this.pagination.querySelector('.page-input').addEventListener('change', async (e) => {
                const newPage = parseInt(e.target.value, 10);
                if (newPage >= 1 && newPage <= this.totalPages) {
                    this.currentPage = newPage;
                    await this.loadComments();
                    this.renderPagination();
                }
            });
        }
    }

    /* ========== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ФУНКЦИИ ========== */
    let initializedBlocks = new WeakMap(); // Хранит инициализированные блоки
    let isInitializing = false; // Флаг для защиты от повторной инициализации

    async function init() {
        if (isInitializing) return;
        isInitializing = true;

        console.log('Parallel INIT started');
        const updatedBlocks = document.querySelectorAll('.b-comments');

        try {
            // Создаем массив промисов для всех блоков
            const initializationPromises = Array.from(updatedBlocks).map(async (container) => {
                try {
                    if (!initializedBlocks.has(container)) {
                        const instance = new CommentsBlock(container);
                        initializedBlocks.set(container, instance);
                        await instance.CreateCommentsBlock();
                        console.log('Successfully initialized:', container);
                    } else {
                        await initializedBlocks.get(container).CreateCommentsBlock();
                    }
                } catch (error) {
                    console.error(`Error processing block ${container}:`, error);
                    // Пробрасываем ошибку дальше, если нужно прервать все операции
                    throw error;
                }
            });

            // Ожидаем завершения ВСЕХ операций параллельно
            await Promise.all(initializationPromises);

        } catch (error) {
            console.error('Global initialization error:', error);
        } finally {
            isInitializing = false;
        }
    }

    let checkInterval = null;
    let lastKnownBlocks = [];


    // Функция для проверки новых блоков комментариев на странице и инициализации
    async function observeNewComments() {
        if (checkInterval) clearInterval(checkInterval);

        console.log("Запуск наблюдения за .b-comments");

        checkInterval = setInterval(async () => {
            const currentBlocks = Array.from(document.querySelectorAll('.b-comments'));

            if (currentBlocks.length !== lastKnownBlocks.length ||
                currentBlocks.some(block => !lastKnownBlocks.includes(block))) {
                console.log("Обнаружены изменения в .b-comments");
                await init(); // Добавлен await для асинхронной init()
                lastKnownBlocks = currentBlocks;
            }
        }, CHECK_INTERVAL);

        const initialBlocks = Array.from(document.querySelectorAll('.b-comments'));
        if (initialBlocks.length > 0) {
            await init();
            lastKnownBlocks = initialBlocks;
        }
    }

    function stopObserving() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    observeNewComments();

})();
