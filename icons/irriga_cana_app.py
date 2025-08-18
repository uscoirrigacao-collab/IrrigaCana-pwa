from PIL import Image, ImageOps

def remove_background(image, bg_color=(255, 255, 255), tolerance=30):
    """
    Remove fundo de cor sólida (ex: branco) e o torna transparente.

    Parâmetros:
        image: PIL.Image (em RGBA)
        bg_color: cor do fundo a remover (default = branco)
        tolerance: margem de tolerância (0 = cor exata, maior = mais flexível)
    """
    image = image.convert("RGBA")
    datas = image.getdata()

    new_data = []
    for item in datas:
        # Verifica se o pixel está dentro da tolerância da cor de fundo
        if all(abs(item[i] - bg_color[i]) <= tolerance for i in range(3)):
            # Transforma em transparente
            new_data.append((255, 255, 255, 0))
        else:
            new_data.append(item)

    image.putdata(new_data)
    return image

# Abrir imagem original
original_image = Image.open("logo_base.jpg").convert("RGBA")

# Obter dimensões
width, height = original_image.size

# Definir caixa de recorte (ajuste conforme necessário)
left = int(width * 0.04)
top = int(height * 0.2)
right = int(width * 0.40)
bottom = int(height * 0.7)

# Recortar a imagem
cropped_c = original_image.crop((left, top, right, bottom))

# Remover fundo branco do recorte
cropped_c = remove_background(cropped_c, bg_color=(255, 255, 255), tolerance=40)

# Lista de tamanhos padrão PWA
icon_sizes = [72, 96, 128, 144, 152, 192, 384, 512, 1024]

# Gerar e salvar ícones
for size in icon_sizes:
    resized_icon = ImageOps.fit(cropped_c, (size, size), Image.LANCZOS)
    output_path = f"icon-{size}.png"
    resized_icon.save(output_path, format="PNG")
    print(f"Ícone salvo: {output_path}")
