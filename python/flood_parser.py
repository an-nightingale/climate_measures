import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


BASE_TEXT_URL = "https://gis.72to.ru/orbismap/public_map/geoportal72/map29/text/"
BASE_MAP_URL = "https://gis.72to.ru/orbismap/public_map/geoportal72/map29/"
OUTPUT_PATH = Path("./data/flood_status.json")

TARGET_SECTIONS = {
    "Перекрытие дорог": "virtual1/",
    "Открытые дороги": "virtual/",
    "Пункты сбора гуманитарной помощи": "virtual5/",
    "Пункты временного размещения": "virtual4/",
    "Пункты вакцинации против гепатита А": "virtual2/",
    "Гидропосты": "virtual6/",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; flood-parser/1.0)"
}


def fetch_html(url: str) -> str:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.text


def parse_root_sections(root_html: str) -> dict[str, str]:
    soup = BeautifulSoup(root_html, "html.parser")
    result = {}

    for a in soup.select("a.layer-list__item-inner[href]"):
        title_el = a.select_one(".layer-list__title")
        if not title_el:
            continue
        title = title_el.get_text(" ", strip=True)
        href = a.get("href", "").strip()
        if title and href:
            result[title] = href

    return result


def parse_section_objects(section_html: str, section_url: str, section_name: str) -> list[dict]:
    soup = BeautifulSoup(section_html, "html.parser")
    objects = []

    for li in soup.select("li.object-list__item"):
        a = li.select_one("a.object-list__link[href]")
        if not a:
            continue

        name = a.get_text(" ", strip=True)
        href = a.get("href", "").strip()
        obj_url = urljoin(section_url, href)

        objects.append({
            "section": section_name,
            "name": name,
            "object_url": obj_url,
        })

    return objects


def extract_feature_geojson(html: str):
    match = re.search(
        r"const\s+featureGeojson\s*=\s*(\{.*?\})\s*const\s+pointImage",
        html,
        flags=re.DOTALL,
    )
    if not match:
        return None

    raw = match.group(1).strip()

    # В этом HTML объект почти JSON-совместим
    # На всякий случай заменяем одинарные кавычки на двойные
    normalized = raw.replace("'", '"')

    try:
        return json.loads(normalized)
    except Exception:
        return None


def parse_object_page(object_html: str, object_url: str, section_name: str) -> dict:
    soup = BeautifulSoup(object_html, "html.parser")

    title_el = soup.select_one("h2.content-title__title")
    title = title_el.get_text(" ", strip=True) if title_el else ""

    map_link_el = soup.select_one("a.content-title__link-open[href]")
    map_url = None
    if map_link_el:
        href = map_link_el.get("href", "").strip()
        if href.startswith("//"):
            map_url = "https:" + href
        else:
            map_url = urljoin(object_url, href)

    properties = {}
    for row in soup.select("div.object-info__table-container tr.table__tr"):
        name_el = row.select_one("td.table__td_name")
        value_el = row.select_one("td.table__td_value")
        if not name_el or not value_el:
            continue

        key = name_el.get_text(" ", strip=True)
        value = value_el.get_text(" ", strip=True)
        if key:
            properties[key] = value

    feature_geojson = extract_feature_geojson(object_html)

    geometry = None
    coordinates = None
    if feature_geojson and isinstance(feature_geojson, dict):
        geometry = feature_geojson.get("geometry")
        if geometry:
            coordinates = geometry.get("coordinates")

    item = {
        "section": section_name,
        "name": title,
        "object_url": object_url,
        "map_url": map_url,
        "properties": properties,
        "feature_geojson": feature_geojson,
        "geometry": geometry,
        "coordinates": coordinates,
    }

    return item


def build_dataset() -> dict:
    root_html = fetch_html(BASE_TEXT_URL)
    discovered_sections = parse_root_sections(root_html)

    dataset = {
        "source_url": BASE_TEXT_URL,
        "map_url": BASE_MAP_URL,
        "parsed_at": datetime.now(timezone.utc).isoformat(),
        "sections": {},
        "items": [],
    }

    for section_name, expected_href in TARGET_SECTIONS.items():
        href = discovered_sections.get(section_name, expected_href)
        section_url = urljoin(BASE_TEXT_URL, href)

        try:
            section_html = fetch_html(section_url)
            object_refs = parse_section_objects(section_html, section_url, section_name)
        except Exception as e:
            dataset["sections"][section_name] = {
                "url": section_url,
                "error": str(e),
                "count": 0,
            }
            continue

        parsed_items = []
        for ref in object_refs:
            try:
                object_html = fetch_html(ref["object_url"])
                item = parse_object_page(object_html, ref["object_url"], section_name)
                parsed_items.append(item)
                dataset["items"].append(item)
            except Exception as e:
                parsed_items.append({
                    "section": section_name,
                    "name": ref["name"],
                    "object_url": ref["object_url"],
                    "error": str(e),
                })

        dataset["sections"][section_name] = {
            "url": section_url,
            "count": len(parsed_items),
            "items": parsed_items,
        }

    return dataset


def save_dataset(dataset: dict, output_path: Path = OUTPUT_PATH):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


def main():
    dataset = build_dataset()
    save_dataset(dataset)
    print(f"Готово. Сохранено объектов: {len(dataset['items'])}")
    print(f"Файл: {OUTPUT_PATH}")


if __name__ == "__main__":
    main()