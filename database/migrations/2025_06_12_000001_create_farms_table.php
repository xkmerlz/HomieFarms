<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('farms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('instance_id')->constrained()->cascadeOnDelete();
            $table->integer('q_min');
            $table->integer('r_min');
            $table->integer('q_max');
            $table->integer('r_max');
            $table->integer('level')->default(1);
            $table->timestamps();

            $table->unique(['user_id', 'instance_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('farms');
    }
};
