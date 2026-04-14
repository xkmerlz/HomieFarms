<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('farm_id')->constrained()->cascadeOnDelete();
            $table->integer('q');
            $table->integer('r');
            $table->string('terrain_type')->default('grass');
            $table->string('structure_type')->nullable();
            $table->integer('structure_tier')->default(0);
            $table->string('crop_type')->nullable();
            $table->timestamp('crop_planted_at')->nullable();
            $table->boolean('crop_watered')->default(false);
            $table->timestamps();

            $table->unique(['farm_id', 'q', 'r']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tiles');
    }
};
