use clap::{Parser, Subcommand};
use image_processor::{generate_thumbnail, equirect_to_cubemap, generate_tiled_cubemap, process_full_pipeline};

#[derive(Parser)]
#[command(name = "image-processor")]
#[command(about = "VR Tour Platform Image Processor - Process 360° images for VR", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a thumbnail from 360° image
    Thumbnail {
        /// Input panoramic image path
        #[arg(short, long)]
        input: String,

        /// Output thumbnail path
        #[arg(short, long)]
        output: String,

        /// Thumbnail width (height will be width/2)
        #[arg(short, long, default_value = "512")]
        width: u32,
    },

    /// Convert equirectangular to cubemap
    Cubemap {
        /// Input panoramic image path
        #[arg(short, long)]
        input: String,

        /// Output directory for cubemap faces
        #[arg(short, long)]
        output: String,

        /// Face size in pixels (square)
        #[arg(short, long, default_value = "1024")]
        face_size: u32,
    },

    /// Generate tiled cubemap with LOD levels
    TiledCubemap {
        /// Input cubemap directory (with px.jpg, nx.jpg, etc.)
        #[arg(short, long)]
        input: String,

        /// Output directory for tiles
        #[arg(short, long)]
        output: String,

        /// Maximum face size for LOD level 0
        #[arg(long, default_value = "2048")]
        max_face_size: u32,

        /// Individual tile size in pixels
        #[arg(long, default_value = "256")]
        tile_size: u32,

        /// Maximum LOD levels to generate
        #[arg(long, default_value = "4")]
        max_levels: u32,
    },

    /// Process complete pipeline: thumbnail + cubemap + tiles
    Process {
        /// Input panoramic image path
        #[arg(short, long)]
        input: String,

        /// Output base directory
        #[arg(short, long)]
        output: String,

        /// Cubemap face size
        #[arg(long, default_value = "1024")]
        cubemap_size: u32,

        /// Tile size for LOD
        #[arg(long, default_value = "256")]
        tile_size: u32,

        /// Maximum LOD levels
        #[arg(long, default_value = "4")]
        max_levels: u32,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Thumbnail { input, output, width } => {
            println!("Generating thumbnail: {} -> {} ({}px)", input, output, width);
            generate_thumbnail(&input, &output, width)?;
            println!("✓ Thumbnail saved to {}", output);
        }

        Commands::Cubemap { input, output, face_size } => {
            println!("Converting equirectangular to cubemap: {} -> {}", input, output);
            println!("  Face size: {}x{}", face_size, face_size);
            equirect_to_cubemap(&input, &output, face_size)?;
            println!("✓ Cubemap generated:");
            println!("  - px.jpg, nx.jpg (left/right)");
            println!("  - py.jpg, ny.jpg (top/bottom)");
            println!("  - pz.jpg, nz.jpg (front/back)");
        }

        Commands::TiledCubemap { input, output, max_face_size, tile_size, max_levels } => {
            println!("Generating tiled cubemap with LOD");
            println!("  Input cubemap: {}", input);
            println!("  Output directory: {}", output);
            println!("  Max face size: {}x{}", max_face_size, max_face_size);
            println!("  Tile size: {}x{}", tile_size, tile_size);
            println!("  Max LOD levels: {}", max_levels);

            generate_tiled_cubemap(&input, &output, max_face_size, tile_size, max_levels)?;
            println!("✓ Tiled cubemap generated with {} LOD levels", max_levels);
            println!("  Metadata saved to {}/metadata.json", output);
        }

        Commands::Process { input, output, cubemap_size, tile_size, max_levels } => {
            println!("Processing complete pipeline");
            println!("  Input: {}", input);
            println!("  Output base: {}", output);
            println!("  Cubemap size: {}x{}", cubemap_size, cubemap_size);
            println!("  Tile size: {}x{}", tile_size, tile_size);
            println!("  LOD levels: {}", max_levels);
            println!();

            process_full_pipeline(&input, &output, cubemap_size, tile_size, max_levels)?;
            
            println!("✓ Pipeline complete!");
            println!("  Thumbnail: {}/thumbnail.jpg", output);
            println!("  Cubemap: {}/cubemap/", output);
            println!("  Tiles: {}/tiles/", output);
        }
    }

    Ok(())
}
