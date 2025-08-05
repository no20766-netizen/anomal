# anomal_store/settings.py

from pathlib import Path
import os

# ──────────────────────────────────────────────────────────
# 기본 경로 설정
# ──────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent

# ──────────────────────────────────────────────────────────
# 보안 설정
# ──────────────────────────────────────────────────────────
SECRET_KEY = 'django-insecure-1234567890'
DEBUG = False

ALLOWED_HOSTS = [
    'anomal.kr',            # 운영 도메인
    'www.anomal.kr',
    'anomal.onrender.com',  # Render 서브도메인
]

# ──────────────────────────────────────────────────────────
# 앱 등록
# ──────────────────────────────────────────────────────────
INSTALLED_APPS = [
    'whitenoise.runserver_nostatic',  # runserver 시에도 static 처리
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'shop',  # 내 앱
]

# ──────────────────────────────────────────────────────────
# 미들웨어 설정
# ──────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Whitenoise 정적 파일 처리

    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# ──────────────────────────────────────────────────────────
# URL 및 WSGI 설정
# ──────────────────────────────────────────────────────────
ROOT_URLCONF = 'anomal_store.urls'
WSGI_APPLICATION = 'anomal_store.wsgi.application'

# ──────────────────────────────────────────────────────────
# 템플릿 설정
# ──────────────────────────────────────────────────────────
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],  # 앱 내부 templates/ 검색
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# ──────────────────────────────────────────────────────────
# 데이터베이스 설정
# ──────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# ──────────────────────────────────────────────────────────
# 비밀번호 검증
# ──────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = []

# ──────────────────────────────────────────────────────────
# 지역화 설정
# ──────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Seoul'
USE_I18N = True
USE_TZ = True

# ──────────────────────────────────────────────────────────
# 정적 파일(Static files) 설정
# ──────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_DIRS = [
    BASE_DIR / 'shop' / 'static',
]
# manifest 없이도 작동하는 Storage
STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'

# ──────────────────────────────────────────────────────────
# 미디어 파일(Media files) 설정
# ──────────────────────────────────────────────────────────
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ──────────────────────────────────────────────────────────
# 기본 자동 필드
# ──────────────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
