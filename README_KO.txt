Film Simulation Note v7 Integrated

용도
----
필름 시뮬레이션 레시피를 직접 기록하고, 후지 원본 JPEG에서 가능한 MakerNote 레시피 값을 읽어 바로 노트에 저장하는 개인용 PWA입니다.

v7 주요 변경
-----------
- 기존 Recipe Note 기능 유지
- JPEG Reader 탭 추가
- 후지 원본 JPEG의 EXIF / Fujifilm MakerNote 분석
- 분석 결과를 새 레시피로 바로 저장
- 저장 후 편집창을 열어 이름, 카테고리, 설명을 수정 가능
- JPEG 커버 이미지는 원본을 저장하지 않고 1MB 이하로 리사이즈/압축 저장
- 리사이즈는 크롭이 아니라 전체 구도와 비율을 유지한 축소입니다.
- 백업 JSON에 JPEG Reader로 저장한 레시피와 압축 커버 이미지 포함

주의
----
- 원본 Fujifilm JPEG 기준으로 가장 정확합니다.
- Lightroom, Photoshop, 메신저, SNS를 거친 JPEG는 MakerNote가 제거되어 레시피 값이 비어 있을 수 있습니다.
- JPEG 안에는 사용자가 만든 레시피 이름은 일반적으로 저장되지 않습니다. 저장 후 직접 이름을 수정하세요.
- 앱 데이터는 서버가 아니라 사용자의 브라우저 IndexedDB에 저장됩니다.

배포
----
ZIP 압축을 푼 뒤 안의 파일과 폴더를 GitHub Pages 저장소 루트에 업로드하세요. ZIP 파일 자체를 업로드하는 방식이 아닙니다.

v7 Final - 저작권 및 이용 안내
-----------------------------
- 앱 상단의 ⓘ 버튼과 시작 화면의 '저작권 및 이용 안내 · Copyright'에서 안내문을 확인할 수 있습니다.
- 한국어 안내가 먼저 표시되고, 영문 안내가 이어서 표시됩니다.
- 개인적·비상업적 이용만 허용됩니다.
- 상업적 이용, 재배포 및 수정본 공개 배포는 허용되지 않습니다.
- 저작권자: Jaden_fujipuerson (KIM JEONGHA)
- 문의: restinmylife@naver.com
- 별도 LICENSE_KO_EN.txt 파일이 포함되어 있습니다.
- 모든 웹 소스 파일은 UTF-8로 저장되었으며, LICENSE/README 텍스트는 한글 호환성을 위해 UTF-8 BOM 형식으로 제공됩니다.
