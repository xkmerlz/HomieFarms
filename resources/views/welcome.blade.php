<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HomieFarms</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
    <style>
        * { font-family: 'Press Start 2P', monospace; -webkit-font-smoothing: none; -moz-osx-font-smoothing: unset; }
        body { image-rendering: pixelated; }
        .pixel-border {
            box-shadow:
                0 4px 0 0 #3B2410,
                4px 0 0 0 #3B2410,
                0 -4px 0 0 #3B2410,
                -4px 0 0 0 #3B2410,
                4px 4px 0 0 #3B2410,
                -4px 4px 0 0 #3B2410,
                4px -4px 0 0 #3B2410,
                -4px -4px 0 0 #3B2410;
        }
    </style>
</head>
<body class="bg-[#1a1a2e] min-h-screen flex items-center justify-center">
    <div class="text-center px-4">
        <h1 class="text-[#F5E6C8] text-2xl md:text-4xl mb-4 leading-relaxed">HomieFarms</h1>
        <p class="text-[#7B6BA5] text-[8px] md:text-[10px] mb-12 leading-loose">grow stuff with your homies</p>

        <a href="{{ route('auth.discord') }}"
           class="inline-block bg-[#5865F2] text-white text-[10px] md:text-xs px-8 py-4 pixel-border
                  hover:bg-[#4752C4] active:translate-y-1 transition-transform cursor-pointer">
            Login with Discord
        </a>

        <p class="text-[#4A7A3A] text-[8px] mt-16 leading-loose opacity-60">an isometric farming adventure</p>
    </div>
</body>
</html>
