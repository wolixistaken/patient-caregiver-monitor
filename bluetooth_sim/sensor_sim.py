import asyncio
import logging
import random
from typing import Any

from bless import (
    BlessServer,
    BlessGATTCharacteristic,
    GATTCharacteristicProperties,
    GATTAttributePermissions
)

# --- AYARLAR (App.js ve BleService.js ile birebir aynı olmalı) ---
DEVICE_NAME = "HealthBand" 
SERVICE_UUID = "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
CHAR_UUID = "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"

# Log ayarları
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(name=DEVICE_NAME)

# Global durum değişkenleri
current_heart_rate = 70
steps = 0
is_fall = 0  # 0: Normal, 1: Düşme

def generate_data():
    """Uygulamanın beklediği format: HR:80,STEPS:100,F:0"""
    global current_heart_rate, steps, is_fall
    
    # Nabzı hafifçe dalgalandır (simülasyon)
    change = random.randint(-2, 2)
    current_heart_rate += change
    
    # Sınırları koru
    if current_heart_rate < 50: current_heart_rate = 52
    if current_heart_rate > 140: current_heart_rate = 138

    # Adım sayısını artır
    steps += random.randint(0, 2)

    data_string = f"HR:{current_heart_rate},STEPS:{steps},F:{is_fall}"
    return data_string.encode('ascii') # Byte formatına çevir

async def run(loop):
    logger.info("Bluetooth Servisi Başlatılıyor...")

    # 1. Server Oluştur
    server = BlessServer(name=DEVICE_NAME, loop=loop)
    server.read_request_func = read_request
    server.write_request_func = write_request

    # 2. Servisi Ekle
    await server.add_new_service(SERVICE_UUID)

    # 3. Karakteristiği Ekle (Notify ve Read özellikleri açık)
    char_flags = (
        GATTCharacteristicProperties.read |
        GATTCharacteristicProperties.notify
    )
    permissions = (
        GATTAttributePermissions.readable |
        GATTAttributePermissions.writeable
    )
    
    await server.add_new_characteristic(
        SERVICE_UUID,
        CHAR_UUID,
        char_flags,
        None,
        permissions
    )

    # 4. Yayına Başla (Advertising)
    logger.info(f"Yayın yapılıyor: {DEVICE_NAME}")
    await server.start()
    
    logger.info("Simülasyon Aktif! Durdurmak için Ctrl+C yapın.")
    logger.info("DÜŞME TESTİ İÇİN: Klavyeden 'd' tuşuna basıp Enter yapın (konsol inputu destekliyorsa)")
    
    try:
        while True:
            # Veriyi oluştur
            data = generate_data()
            logger.info(f"Gönderiliyor: {data.decode('utf-8')}")

            # Bağlı cihaz varsa veriyi gönder (Notify)
            # Not: Bless kütüphanesinde update_value notify tetikler
            server.get_characteristic(CHAR_UUID).value = data
            server.update_value(SERVICE_UUID, CHAR_UUID)
            
            await asyncio.sleep(1) # 1 saniye bekle

    except KeyboardInterrupt:
        pass
    except Exception as e:
        logger.error(f"Hata: {e}")
    finally:
        logger.info("Durduruluyor...")
        await server.stop()

def read_request(characteristic: BlessGATTCharacteristic, **kwargs) -> bytearray:
    return generate_data()

def write_request(characteristic: BlessGATTCharacteristic, value: Any, **kwargs):
    logger.info(f"Yazma isteği geldi: {value}")

# Windows için ana döngü
if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(run(loop))
    except KeyboardInterrupt:
        print("\nKapatıldı.")