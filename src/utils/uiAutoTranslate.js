import { useEffect } from 'react';
import i18n from '@/i18n';

const EXACT_UK = {
  'Track': 'Трек',
  'Title A-Z': 'Назва А-Я',
  'Newest': 'Найновіші',
  'Add songs to make them appear here': 'Додай пісні, щоб вони з’явилися тут',
  'Find a song by title or artist, then choose the right result.': 'Знайди пісню за назвою або виконавцем, потім вибери правильний результат.',
  'Paste a public Spotify playlist link. If Spotify API access is available, DreamTune will pull as many tracks as possible across pages.': 'Встав публічне посилання на Spotify-плейлист. Якщо доступ до Spotify API є, DreamTune підтягне якомога більше треків з усіх сторінок.',
  'Enter a track title, artist, or Spotify track link. Then choose the right result.': 'Введи назву треку, виконавця або Spotify-посилання на трек. Потім вибери правильний результат.',
  'Find playlist': 'Знайти плейлист',
  'Find track': 'Знайти трек',
  'Import': 'Імпортувати',
  'Open on YouTube': 'Відкрити в YouTube',
  'Without Spotify API keys, Spotify only exposes the first 100 tracks. If those are already added, the server cannot see the next tracks without keys.': 'Без Spotify API ключів Spotify показує тільки перші 100 треків. Якщо вони вже додані, сервер не побачить наступні треки без ключів.',
  'Could not load tracks. Check that the playlist is public and the link is correct.': 'Не вдалося завантажити треки. Перевір, що плейлист публічний і посилання правильне.',
  'No new tracks found in this playlist: everything is already in your library.': 'У цьому плейлисті немає нових треків: усе вже є в бібліотеці.',
  'Playlist name...': 'Назва плейлиста...',
  'Add to playlist': 'Додати в плейлист',
  'Play next': 'Грати наступною',
  'Add to queue': 'Додати в чергу',
  'Remove from playlist': 'Прибрати з плейлиста',
  'Edit': 'Редагувати',
  'Library shuffled': 'Бібліотеку перемішано',
  'Could not add to playlist': 'Не вдалося додати в плейлист',
  'Could not delete selected songs': 'Не вдалося видалити вибрані пісні',
  'Close selection': 'Закрити вибір',
  'Home': 'Головна',
  'Library': 'Бібліотека',
  'Collab': 'Спільні',
  'Playlists': 'Плейлисти',
  'Add': 'Додати',
  'Profile': 'Профіль',
  'Friends': 'Друзі',
  'Stats': 'Статистика',
  'Theme': 'Тема',
  'Sleep timer': 'Таймер сну',
  'Language': 'Мова',
  'Settings': 'Налаштування',
  'Sign out': 'Вийти',
  'Sign in': 'Увійти',
  'Create account': 'Створити акаунт',
  'Create profile': 'Створити профіль',
  'Email verification': 'Підтвердження email',
  'Email': 'Email',
  'Nickname': 'Нікнейм',
  'Email or nickname': 'Email або нікнейм',
  'Password': 'Пароль',
  'Confirm password': 'Підтвердити пароль',
  'Please wait...': 'Зачекай...',
  'Email code': 'Код з email',
  'Confirm and sign in': 'Підтвердити й увійти',
  'Change email or nickname': 'Змінити email або нікнейм',
  'minimum 6 characters': 'мінімум 6 символів',
  'repeat password': 'повтори пароль',
  'Hide password': 'Сховати пароль',
  'Show password': 'Показати пароль',
  'We sent a code to': 'Ми надіслали код на',
  '. Enter it below and your profile will sign in right away.': '. Введи його нижче, і профіль одразу увійде.',
  'Search': 'Пошук',
  'File': 'Файл',
  'Spotify': 'Spotify',
  'YouTube': 'YouTube',
  'Queue': 'Черга',
  'Lyrics': 'Текст',
  'Player': 'Плеєр',
  'Albums': 'Альбоми',
  'Favorites': 'Улюблені',
  'Admin panel': 'Панель адміністратора',
  'DreamTune Control': 'Керування DreamTune',
  'What are we listening to today?': 'Що слухаємо сьогодні?',
  'Recently added': 'Нещодавно додані',
  'Global Top': 'Світовий топ',
  'Spotify Top 20': 'Spotify Топ 20',
  'Favorite tracks': 'Улюблені треки',
  'All tracks by date added': 'Усі треки за датою додавання',
  'Loading chart...': 'Завантажуємо чарт...',
  'Loading global chart...': 'Завантажуємо світовий чарт...',
  'Loading Spotify Top 20...': 'Завантажуємо Spotify Топ 20...',
  'The chart is temporarily unavailable': 'Чарт тимчасово недоступний',
  'Spotify Top 20 is temporarily unavailable': 'Spotify Топ 20 тимчасово недоступний',
  'Download:': 'Завантаження:',
  'See all': 'Дивитись усі',
  'Scroll left': 'Прокрутити вліво',
  'Scroll right': 'Прокрутити вправо',
  'Unknown artist': 'Невідомий виконавець',
  'Made for you': 'Для тебе',
  'AI recommendations': 'AI-рекомендації',
  'Smart recommendations': 'Розумні рекомендації',
  'Nothing here yet': 'Тут поки нічого немає',
  'Tap the add button below to add your first song': 'Натисни кнопку додавання внизу, щоб додати першу пісню',
  'Nothing found': 'Нічого не знайдено',
  'Search your songs': 'Шукай свої пісні',
  'Add songs to make albums appear here': 'Додай пісні, щоб тут з’явилися альбоми',
  'Tap the heart on a song to add it to favorites': 'Натисни сердечко на пісні, щоб додати її в улюблені',
  'Create your first playlist': 'Створи свій перший плейлист',
  'Create your first collaborative playlist': 'Створи свій перший спільний плейлист',
  'Public playlists': 'Публічні плейлисти',
  'No public playlists yet.': 'Публічних плейлистів поки немає.',
  'Profile not found': 'Профіль не знайдено',
  'Album not found': 'Альбом не знайдено',
  'Add songs': 'Додати пісні',
  'Add songs to this playlist': 'Додай пісні в цей плейлист',
  'Playlist cover': 'Обкладинка плейлиста',
  'Collaborative playlist': 'Спільний плейлист',
  'Collaborative playlist actions': 'Дії зі спільним плейлистом',
  'Playlist': 'Плейлист',
  'Playlist actions': 'Дії з плейлистом',
  'Add member': 'Додати учасника',
  'No friends available to invite. Friends already added are hidden here.': 'Немає друзів, яких можна запросити. Уже додані друзі тут приховані.',
  'Back': 'Назад',
  'Shuffle': 'Перемішати',
  'Selected': 'Вибрано',
  'Select': 'Вибрати',
  'Select all': 'Вибрати всі',
  'Clear all': 'Очистити все',
  'Done': 'Готово',
  'Delete': 'Видалити',
  'Close': 'Закрити',
  'Cancel': 'Скасувати',
  'Save': 'Зберегти',
  'Saving...': 'Збереження...',
  'Saved': 'Збережено',
  'Save failed': 'Не вдалося зберегти',
  'Update failed': 'Не вдалося оновити',
  'Updated': 'Оновлено',
  'Deleted': 'Видалено',
  'Create': 'Створити',
  'Start': 'Запустити',
  'Reset': 'Скинути',
  'Choose': 'Вибрати',
  'Share': 'Поділитися',
  'Title': 'Назва',
  'Artist': 'Виконавець',
  'Song title': 'Назва пісні',
  'Artist name': 'Ім’я виконавця',
  'Cover': 'Обкладинка',
  'Scale': 'Масштаб',
  'Edit song': 'Редагувати пісню',
  'Trim track': 'Обрізати трек',
  'Hold an edge and move it along the waveform': 'Затисни край і рухай його по хвилі',
  'Drag the point across the photo': 'Перетягни точку по фото',
  'Drag the photo or pinch to zoom': 'Перетягни фото або збільшуй пальцями',
  'Avatar': 'Аватар',
  'Custom background photo': 'Власне фото фону',
  'Use any image as the app background.': 'Використай будь-яке зображення як фон додатка.',
  'Show backgrounds': 'Показати фони',
  'Hide backgrounds': 'Сховати фони',
  'Background updated': 'Фон оновлено',
  'Avatar updated': 'Аватар оновлено',
  'Could not open photo': 'Не вдалося відкрити фото',
  'Could not save photo': 'Не вдалося зберегти фото',
  'Could not upload photo': 'Не вдалося завантажити фото',
  'Nickname must be longer': 'Нікнейм має бути довшим',
  'Nickname updated': 'Нікнейм оновлено',
  'Nickname updated on this device': 'Нікнейм оновлено на цьому пристрої',
  'Friend nickname...': 'Нік друга...',
  'Add friend': 'Додати друга',
  'Found users': 'Знайдені користувачі',
  'Friend': 'Друг',
  'Pending': 'Очікує',
  'Requests': 'Запити',
  'Available for collaborative playlists': 'Доступний для спільних плейлистів',
  'Add friends by nickname to create collaborative playlists with them later.': 'Додай друзів за нікнеймом, щоб потім створювати з ними спільні плейлисти.',
  'No data for this period yet': 'За цей період ще немає даних',
  'Start listening so DreamTune can build your vibe.': 'Почни слухати, щоб DreamTune зібрав твою атмосферу.',
  'Most played': 'Найчастіше слухали',
  'Mode': 'Режим',
  'Remaining': 'Залишилось',
  'Custom time in minutes': 'Свій час у хвилинах',
  'Privacy': 'Приватність',
  'Support': 'Підтримка',
  'About': 'Про додаток',
  'Account': 'Акаунт',
  'The email subject will be filled in automatically.': 'Тема листа заповниться автоматично.',
  'DreamTune is your personal music space for tracks, playlists, themes, and collaborative listening.': 'DreamTune — твій особистий музичний простір для треків, плейлистів, тем і спільного прослуховування.',
  'The app is designed to keep music, covers, and settings close without extra noise.': 'Додаток створений, щоб музика, обкладинки й налаштування були поруч без зайвого шуму.',
  'Are you sure? This will delete all your data forever.': 'Точно? Це назавжди видалить усі твої дані.',
  'Queue is empty': 'Черга порожня',
  'Hold and drag to reorder': 'Затисни й перетягни, щоб змінити порядок',
  'Up next': 'Далі в черзі',
  'Remove from queue': 'Прибрати з черги',
  'No playlists yet': 'Плейлистів поки немає',
  'More actions': 'Більше дій',
  'Added to playlist': 'Додано в плейлист',
  'Added to queue': 'Додано в чергу',
  'Will play next': 'Заграє наступною',
  'Title copied': 'Назву скопійовано',
  'Could not share': 'Не вдалося поділитися',
  'Shuffle enabled': 'Перемішування увімкнено',
  'Shuffle disabled': 'Перемішування вимкнено',
  'Cancel sleep timer': 'Скасувати таймер сну',
  'Sleep timer: off': 'Таймер сну: вимкнено',
  'Sleep timer: 15 min': 'Таймер сну: 15 хв',
  'Sleep timer: 30 min': 'Таймер сну: 30 хв',
  'Sleep timer: 45 min': 'Таймер сну: 45 хв',
  'Sleep timer: 60 min': 'Таймер сну: 60 хв',
  'Hard bass boost': 'Потужний бас',
  'soft': 'м’яко',
  'punchy': 'сильно',
  'very hard': 'дуже сильно',
  'Vibe presets': 'Готові вайби',
  '6-band EQ': '6-смуговий EQ',
  'Offline': 'Офлайн',
  'Available offline': 'Доступно офлайн',
  'Save offline': 'Зберегти офлайн',
  'Remove offline copy': 'Прибрати офлайн-копію',
  'Sync the rest': 'Довантажити решту',
  'Removed from offline': 'Прибрано з офлайну',
  'Could not download': 'Не вдалося завантажити',
  'Playlist saved offline': 'Плейлист збережено офлайн',
  'Offline copies removed': 'Офлайн-копії видалено',
  'No network connection': 'Немає інтернету',
  'DreamTune is still loading data': 'DreamTune ще завантажує дані',
  'You can keep using the app.': 'Можеш і далі користуватись додатком.',
  'DreamTune is loading...': 'DreamTune завантажується...',
  'Open profile': 'Відкрити профіль',
  'Close profile menu': 'Закрити меню профілю',
  'Could not sign out': 'Не вдалося вийти',
  'Signed out': 'Вийшла з акаунта',
  'Signed in': 'Вхід виконано',
  'Email verified, signing in': 'Email підтверджено, входимо',
  'Verification code sent to your email': 'Код підтвердження надіслано на email',
  'Enter the email verification code': 'Введи код підтвердження з email',
  'Password must be at least 6 characters': 'Пароль має бути мінімум 6 символів',
  'Passwords do not match': 'Паролі не збігаються',
  'Something went wrong': 'Щось пішло не так',
  'Test code for local development:': 'Тестовий код для локальної розробки:',
  'Access Restricted': 'Доступ обмежено',
  'If you believe this is an error, you can:': 'Якщо думаєш, що це помилка, можеш:',
  'Verify you are logged in with the correct account': 'Перевірити, що ти увійшла в правильний акаунт',
  'Contact the app administrator for access': 'Звернутися до адміністратора додатка',
  'Try logging out and back in again': 'Вийти й увійти ще раз',
  'Add song': 'Додати пісню',
  'Choose audio file': 'Вибрати аудіофайл',
  'Preview before adding': 'Прослухати перед додаванням',
  'Song added!': 'Пісню додано!',
  'Upload failed': 'Не вдалося завантажити',
  'Uploading...': 'Завантаження...',
  'Song title...': 'Назва пісні...',
  'Artist name...': 'Ім’я виконавця...',
  'Keep this screen open while DreamTune searches or downloads from YouTube. Leaving the app can interrupt the process.': 'Тримай цей екран відкритим, поки DreamTune шукає або завантажує з YouTube. Вихід з додатка може перервати процес.',
  'Example: The Weeknd - Blinding Lights': 'Приклад: The Weeknd - Blinding Lights',
  'Selected': 'Вибрано',
  'Prepare preview': 'Підготувати прев’ю',
  'Preparing preview...': 'Готуємо прев’ю...',
  'Adding...': 'Додавання...',
  'Could not add song': 'Не вдалося додати пісню',
  'Song added and saved offline!': 'Пісню додано й збережено офлайн!',
  'Song added, but the offline copy was not saved.': 'Пісню додано, але офлайн-копію не збережено.',
  'Select at least one track': 'Вибери хоча б один трек',
  'Spotify playlist created': 'Spotify-плейлист створено',
  'Could not prepare any tracks for background download': 'Не вдалося підготувати треки для фонового завантаження',
  'Search': 'Пошук',
  'Loading tracks...': 'Завантажуємо треки...',
  'Searching track...': 'Шукаємо трек...',
  'Import complete': 'Імпорт завершено',
  'Adding songs...': 'Додаємо пісні...',
  'Saving to library...': 'Зберігаємо в бібліотеку...',
  'Saving offline copy...': 'Зберігаємо офлайн-копію...',
  'Added offline': 'Додано офлайн',
  'Added, offline copy was not saved': 'Додано, але офлайн-копію не збережено',
  'Could not load recommendations': 'Не вдалося завантажити рекомендації',
  'Add more favorite tracks and DreamTune will suggest similar songs.': 'Додай більше улюблених треків, і DreamTune запропонує схожі пісні.',
  'Monthly awards': 'Місячні нагороди',
  'Your soundtrack': 'Твій саундтрек',
  'Top artist': 'Топ-виконавець',
  'Hit of the month': 'Хіт місяця',
  'Unique songs': 'Унікальні пісні',
  'Open profile': 'Відкрити профіль',
  'New playlist': 'Новий плейлист',
  'Create a playlist first': 'Спочатку створи плейлист',
  'Playlist created': 'Плейлист створено',
  'Playlist deleted': 'Плейлист видалено',
  'Could not delete playlist': 'Не вдалося видалити плейлист',
  'Song removed from playlist': 'Пісню прибрано з плейлиста',
  'Could not remove song': 'Не вдалося прибрати пісню',
  'Cover updated': 'Обкладинку оновлено',
  'Could not update cover': 'Не вдалося оновити обкладинку',
  'This playlist has no playable audio': 'У цьому плейлисті немає треків для програвання',
  'Playlist shuffled': 'Плейлист перемішано',
  'Collaborative playlist updated': 'Спільний плейлист оновлено',
  'Collaborative playlist created': 'Спільний плейлист створено',
  'User': 'Користувач',
  'Status': 'Статус',
  'Date': 'Дата',
  'Actions': 'Дії',
  'Refresh': 'Оновити',
  'Unverified email': 'Email не підтверджено',
  'Blocked': 'Заблоковано',
  'Total accounts': 'Усього акаунтів',
  'Search by nickname or email': 'Пошук за ніком або email',
  'Search playlist': 'Пошук плейлиста',
  'Delete playlist': 'Видалити плейлист',
  'Could not load admin panel': 'Не вдалося завантажити адмін-панель',
  'User blocked': 'Користувача заблоковано',
  'User unblocked': 'Користувача розблоковано',
  'Role updated': 'Роль оновлено',
  'Could not update user': 'Не вдалося оновити користувача',
  'Account deleted': 'Акаунт видалено',
  'Could not delete account': 'Не вдалося видалити акаунт',
  'Could not load tracks from your account. Check your connection and try again.': 'Не вдалося завантажити треки з акаунта. Перевір інтернет і спробуй ще раз.',
  'Could not load audio. Try again.': 'Не вдалося завантажити звук. Спробуй ще раз.',
  'Audio is unavailable, repairing this track...': 'Аудіо недоступне, відновлюємо трек...',
  'Done, audio restored': 'Готово, звук відновлено',
  'Could not restore this track automatically': 'Не вдалося автоматично відновити цей трек',
  'Lyrics found': 'Текст знайдено',
  'Synced lyrics found': 'Синхронізований текст знайдено',
  'Lyrics saved': 'Текст збережено',
  'Paste song lyrics. For perfect sync, you can use LRC:\n[00:15.20] first line\n[00:18.50] second line': 'Встав текст пісні. Для ідеальної синхронізації можна використати LRC:\n[00:15.20] перший рядок\n[00:18.50] другий рядок',
  'pagination': 'пагінація',
  'Go to previous page': 'На попередню сторінку',
  'Go to next page': 'На наступну сторінку',
  'Previous': 'Назад',
  'Next': 'Далі',
  'More': 'Ще',
  'More pages': 'Більше сторінок',
  'Previous slide': 'Попередній слайд',
  'Next slide': 'Наступний слайд',
  'Toggle Sidebar': 'Перемкнути сайдбар',
};

const DYNAMIC_UK = [
  [/^(\d+) songs · (\d+) artists$/i, ([, songs, artists]) => `${songs} ${pluralUk(songs, 'пісня', 'пісні', 'пісень')} · ${artists} ${pluralUk(artists, 'артист', 'артисти', 'артистів')}`],
  [/^(\d+) songs · (\d+) favorites · (\d+) artists$/i, ([, songs, favorites, artists]) => `${songs} ${pluralUk(songs, 'пісня', 'пісні', 'пісень')} · ${favorites} ${pluralUk(favorites, 'улюблена', 'улюблені', 'улюблених')} · ${artists} ${pluralUk(artists, 'артист', 'артисти', 'артистів')}`],
  [/^(\d+) songs$/i, ([, count]) => `${count} ${pluralUk(count, 'пісня', 'пісні', 'пісень')}`],
  [/^(\d+) tracks$/i, ([, count]) => `${count} ${pluralUk(count, 'трек', 'треки', 'треків')}`],
  [/^(\d+) public$/i, ([, count]) => `${count} ${pluralUk(count, 'публічний', 'публічні', 'публічних')}`],
  [/^(\d+) favorites$/i, ([, count]) => `${count} ${pluralUk(count, 'улюблена', 'улюблені', 'улюблених')}`],
  [/^(\d+) artists$/i, ([, count]) => `${count} ${pluralUk(count, 'артист', 'артисти', 'артистів')}`],
  [/^(\d+)\/(\d+) saved$/i, ([, done, total]) => `${done}/${total} збережено`],
  [/^(\d+)%$/i, ([, percent]) => `${percent}%`],
  [/^(\d+) of (\d+) tracks selected\.$/i, ([, selected, total]) => `${selected} з ${total} треків вибрано.`],
  [/^(\d+) new of (\d+) tracks\. All new tracks will be imported\.$/i, ([, count, total]) => `${count} нових із ${total} треків. Усі нові треки будуть імпортовані.`],
  [/^(\d+) new of (\d+) tracks\. (\d+) already in your library\.$/i, ([, count, total, skipped]) => `${count} нових із ${total} треків. ${skipped} уже в бібліотеці.`],
  [/^Added (\d+) of (\d+) tracks$/i, ([, added, total]) => `Додано ${added} з ${total} треків`],
  [/^Background download started: (\d+) tracks$/i, ([, count]) => `Фонове завантаження почалось: ${count} ${pluralUk(count, 'трек', 'треки', 'треків')}`],
  [/^Saving (\d+) library tracks offline in the background$/i, ([, count]) => `Зберігаємо ${count} ${pluralUk(count, 'трек', 'треки', 'треків')} з бібліотеки офлайн у фоні`],
  [/^(\d+) library tracks are available offline$/i, ([, count]) => `${count} ${pluralUk(count, 'трек', 'треки', 'треків')} з бібліотеки доступні офлайн`],
  [/^Repairing (\d+) old tracks in the background$/i, ([, count]) => `Відновлюємо ${count} ${pluralUk(count, 'старий трек', 'старі треки', 'старих треків')} у фоні`],
  [/^Repaired (\d+) old tracks$/i, ([, count]) => `Відновлено ${count} ${pluralUk(count, 'старий трек', 'старі треки', 'старих треків')}`],
  [/^Could not download (\d+) tracks in the background$/i, ([, count]) => `Не вдалося завантажити ${count} ${pluralUk(count, 'трек', 'треки', 'треків')} у фоні`],
  [/^Added (\d+) tracks in the background$/i, ([, count]) => `Додано ${count} ${pluralUk(count, 'трек', 'треки', 'треків')} у фоні`],
  [/^Downloaded (\d+) tracks\. (\d+) failed\.$/i, ([, ok, failed]) => `Завантажено ${ok} ${pluralUk(ok, 'трек', 'треки', 'треків')}. Не вдалося: ${failed}.`],
  [/^All (\d+) tracks were downloaded\.$/i, ([, count]) => `Усі ${count} ${pluralUk(count, 'трек', 'треки', 'треків')} завантажено.`],
  [/^Sleep timer: (\d+) min$/i, ([, count]) => `Таймер сну: ${count} хв`],
  [/^(\d+) min$/i, ([, count]) => `${count} хв`],
  [/^(\d+) h\. (\d+) min\.$/i, ([, hours, minutes]) => `${hours} год. ${minutes} хв.`],
  [/^(\d+) min\.$/i, ([, minutes]) => `${minutes} хв.`],
  [/^Added to "(.+)"$/i, ([, name]) => `Додано в "${name}"`],
  [/^(\d+) songs added to "(.+)"$/i, ([, count, name]) => `${count} ${pluralUk(count, 'пісню', 'пісні', 'пісень')} додано в "${name}"`],
  [/^(\d+) songs deleted$/i, ([, count]) => `${count} ${pluralUk(count, 'пісню', 'пісні', 'пісень')} видалено`],
  [/^"(.+)" saved offline$/i, ([, title]) => `"${title}" збережено офлайн`],
  [/^Playlist "(.+)" shuffled$/i, ([, name]) => `Плейлист "${name}" перемішано`],
  [/^Playing "(.+)"$/i, ([, name]) => `Грає "${name}"`],
  [/^Invite sent to (.+)$/i, ([, name]) => `Запрошення надіслано ${name}`],
  [/^(.+) added a track to the playlist$/i, ([, name]) => `${name} додав(ла) трек у плейлист`],
  [/^@(.+) added to friends$/i, ([, name]) => `@${name} додано в друзі`],
  [/^Request sent to @(.+)$/i, ([, name]) => `Запит надіслано @${name}`],
  [/^Remove @(.+) from friends\?$/i, ([, name]) => `Прибрати @${name} з друзів?`],
  [/^Delete "(.+)" forever\?$/i, ([, title]) => `Видалити "${title}" назавжди?`],
  [/^Delete (\d+) songs forever\?$/i, ([, count]) => `Видалити ${count} ${pluralUk(count, 'пісню', 'пісні', 'пісень')} назавжди?`],
  [/^Delete account "(.+)"\? This will permanently remove all their data\.$/i, ([, name]) => `Видалити акаунт "${name}"? Це назавжди прибере всі його дані.`],
  [/^Delete collaborative playlist "(.+)"\?$/i, ([, name]) => `Видалити спільний плейлист "${name}"?`],
];

const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title', 'alt'];
const textOriginals = new WeakMap();
const attrOriginals = new WeakMap();

function pluralUk(value, one, few, many) {
  const n = Math.abs(Number(value));
  const lastTwo = n % 100;
  const last = n % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

function normalize(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function translateUiText(value, language = i18n.resolvedLanguage || i18n.language) {
  if (!String(language || '').toLowerCase().startsWith('uk')) return value;
  const raw = String(value ?? '');
  if (!raw.trim()) return value;

  const leading = raw.match(/^\s*/)?.[0] || '';
  const trailing = raw.match(/\s*$/)?.[0] || '';
  const core = normalize(raw);
  const exact = EXACT_UK[core];
  if (exact) return `${leading}${exact}${trailing}`;

  for (const [pattern, build] of DYNAMIC_UK) {
    const match = core.match(pattern);
    if (match) return `${leading}${build(match)}${trailing}`;
  }

  return value;
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest('script, style, code, pre, textarea, [data-no-translate]'));
}

function translateTextNode(node, language) {
  if (shouldSkipTextNode(node)) return;
  const current = node.nodeValue || '';
  const original = textOriginals.get(node);

  if (!String(language || '').toLowerCase().startsWith('uk')) {
    if (original && current !== original) node.nodeValue = original;
    return;
  }

  const previousTranslation = original ? translateUiText(original, language) : null;
  const base = original && current === previousTranslation ? original : current;
  textOriginals.set(node, base);
  const translated = translateUiText(base, language);
  if (translated !== current) node.nodeValue = translated;
}

function translateAttributes(element, language) {
  if (!(element instanceof HTMLElement)) return;
  if (element.closest('script, style, code, pre, [data-no-translate]')) return;

  for (const attr of TRANSLATABLE_ATTRIBUTES) {
    if (!element.hasAttribute(attr)) continue;
    const current = element.getAttribute(attr) || '';
    let originals = attrOriginals.get(element);
    if (!originals) {
      originals = {};
      attrOriginals.set(element, originals);
    }

    if (!String(language || '').toLowerCase().startsWith('uk')) {
      if (originals[attr] && current !== originals[attr]) element.setAttribute(attr, originals[attr]);
      continue;
    }

    const previousTranslation = originals[attr] ? translateUiText(originals[attr], language) : null;
    const base = originals[attr] && current === previousTranslation ? originals[attr] : current;
    originals[attr] = base;
    const translated = translateUiText(base, language);
    if (translated !== current) element.setAttribute(attr, translated);
  }
}

function walkAndTranslate(root, language) {
  if (!root) return;
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) translateAttributes(root, language);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) translateTextNode(node, language);
    else if (node.nodeType === Node.ELEMENT_NODE) translateAttributes(node, language);
    node = walker.nextNode();
  }
}

export default function useUiAutoTranslate() {
  useEffect(() => {
    if (typeof window === 'undefined' || !document.body) return undefined;

    let frame = 0;
    let applying = false;
    const getLanguage = () => i18n.resolvedLanguage || i18n.language || localStorage.getItem('dreamtune-language') || 'en';
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        applying = true;
        walkAndTranslate(document.body, getLanguage());
        document.documentElement.lang = String(getLanguage()).startsWith('uk') ? 'uk' : 'en';
        applying = false;
      });
    };

    const observer = new MutationObserver((mutations) => {
      if (applying) return;
      if (mutations.some(mutation => mutation.type === 'childList' || mutation.type === 'characterData' || mutation.type === 'attributes')) {
        schedule();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    const originalConfirm = window.confirm.bind(window);
    window.confirm = (message) => originalConfirm(translateUiText(String(message ?? ''), getLanguage()));

    i18n.on('languageChanged', schedule);
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      i18n.off('languageChanged', schedule);
      window.confirm = originalConfirm;
    };
  }, []);
}
